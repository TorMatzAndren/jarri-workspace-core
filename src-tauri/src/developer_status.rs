use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const APPLICATION_VERSION: &str = env!("CARGO_PKG_VERSION");
const SOURCE_MANIFEST_DIR: &str = env!("CARGO_MANIFEST_DIR");

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeveloperStatus {
    pub application_version: String,
    pub source_repository: RepositoryStatus,
    pub release_availability: ReleaseAvailability,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryStatus {
    pub available: bool,
    pub branch: Option<String>,
    pub detached_head: bool,
    pub short_commit: Option<String>,
    pub working_tree_clean: Option<bool>,
    pub error: Option<RepositoryStatusError>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryStatusError {
    pub code: RepositoryStatusErrorCode,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RepositoryStatusErrorCode {
    SourceUnavailable,
    NotRepository,
    GitUnavailable,
    CommandFailed,
    InvalidOutput,
}

/// Release checking is deliberately independent from local Git inspection.
/// This phase reports `notChecked`; a later frontend/backend feature can fill
/// in these fields without changing the repository status contract.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseAvailability {
    pub state: ReleaseAvailabilityState,
    pub latest_version: Option<String>,
    pub release_url: Option<String>,
    pub checked_at: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // Availability states are reserved for the separate release-check phase.
pub enum ReleaseAvailabilityState {
    NotChecked,
    Available,
    Current,
    Unavailable,
}

#[derive(Debug)]
struct GitCommandError {
    code: RepositoryStatusErrorCode,
    message: String,
}

fn source_repository_path() -> Result<PathBuf, RepositoryStatusError> {
    let manifest_dir = Path::new(SOURCE_MANIFEST_DIR);
    let root = manifest_dir.parent().ok_or_else(|| RepositoryStatusError {
        code: RepositoryStatusErrorCode::SourceUnavailable,
        message: "Could not resolve the application source directory from build metadata.".into(),
    })?;

    root.canonicalize().map_err(|error| RepositoryStatusError {
        code: RepositoryStatusErrorCode::SourceUnavailable,
        message: format!("Application source directory is unavailable: {error}"),
    })
}

fn git_command(
    git_program: &Path,
    repository: &Path,
    args: &[&str],
) -> Result<Output, GitCommandError> {
    let mut command = Command::new(git_program);
    command
        .arg("--no-optional-locks")
        .arg("-C")
        .arg(repository)
        .args(args)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C");

    // Do not let ambient Git variables redirect a status request to another
    // repository, worktree, or index.
    for variable in [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_COMMON_DIR",
        "GIT_INDEX_FILE",
        "GIT_PREFIX",
        "GIT_CEILING_DIRECTORIES",
    ] {
        command.env_remove(variable);
    }

    command.output().map_err(|error| {
        let code = if error.kind() == std::io::ErrorKind::NotFound {
            RepositoryStatusErrorCode::GitUnavailable
        } else {
            RepositoryStatusErrorCode::CommandFailed
        };
        GitCommandError {
            code,
            message: format!("Could not run Git: {error}"),
        }
    })
}

fn checked_git_output(
    git_program: &Path,
    repository: &Path,
    args: &[&str],
) -> Result<String, GitCommandError> {
    let output = git_command(git_program, repository, args)?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(GitCommandError {
            code: RepositoryStatusErrorCode::CommandFailed,
            message: if detail.is_empty() {
                format!("Git command failed with {}.", output.status)
            } else {
                detail
            },
        });
    }

    String::from_utf8(output.stdout)
        .map(|value| value.trim().to_owned())
        .map_err(|_| GitCommandError {
            code: RepositoryStatusErrorCode::InvalidOutput,
            message: "Git returned output that was not valid UTF-8.".into(),
        })
}

fn repository_status(repository: &Path, git_program: &Path) -> RepositoryStatus {
    if !repository.is_dir() {
        return unavailable_repository(
            RepositoryStatusErrorCode::SourceUnavailable,
            format!(
                "Application source directory does not exist: {}",
                repository.display()
            ),
        );
    }

    let top_level =
        match checked_git_output(git_program, repository, &["rev-parse", "--show-toplevel"]) {
            Ok(path) => path,
            Err(error) => {
                let not_repository = error.message.contains("not a git repository");
                return unavailable_repository(
                    if not_repository {
                        RepositoryStatusErrorCode::NotRepository
                    } else {
                        error.code
                    },
                    error.message,
                );
            }
        };

    let canonical_top_level_matches = Path::new(&top_level)
        .canonicalize()
        .map(|path| path == repository)
        .unwrap_or(false);
    if !canonical_top_level_matches {
        return unavailable_repository(
            RepositoryStatusErrorCode::NotRepository,
            "Application source directory is not the root of its Git repository.".into(),
        );
    }

    let head = match checked_git_output(
        git_program,
        repository,
        &["rev-parse", "--abbrev-ref", "HEAD"],
    ) {
        Ok(head) => head,
        Err(error) => return unavailable_from_git_error(error),
    };
    let commit = match checked_git_output(
        git_program,
        repository,
        &["rev-parse", "--short=12", "HEAD"],
    ) {
        Ok(commit) if !commit.is_empty() => commit,
        Ok(_) => {
            return unavailable_repository(
                RepositoryStatusErrorCode::InvalidOutput,
                "Git returned an empty commit identifier.".into(),
            )
        }
        Err(error) => return unavailable_from_git_error(error),
    };
    let working_tree = match checked_git_output(
        git_program,
        repository,
        &["status", "--porcelain=v1", "--untracked-files=all"],
    ) {
        Ok(status) => status,
        Err(error) => return unavailable_from_git_error(error),
    };

    let detached_head = head == "HEAD";
    RepositoryStatus {
        available: true,
        branch: (!detached_head).then_some(head),
        detached_head,
        short_commit: Some(commit),
        working_tree_clean: Some(working_tree.is_empty()),
        error: None,
    }
}

fn unavailable_from_git_error(error: GitCommandError) -> RepositoryStatus {
    let code = if error.message.contains("not a git repository") {
        RepositoryStatusErrorCode::NotRepository
    } else {
        error.code
    };
    unavailable_repository(code, error.message)
}

fn unavailable_repository(code: RepositoryStatusErrorCode, message: String) -> RepositoryStatus {
    RepositoryStatus {
        available: false,
        branch: None,
        detached_head: false,
        short_commit: None,
        working_tree_clean: None,
        error: Some(RepositoryStatusError { code, message }),
    }
}

fn developer_status_for(repository: Result<PathBuf, RepositoryStatusError>) -> DeveloperStatus {
    let source_repository = match repository {
        Ok(path) => repository_status(&path, Path::new("git")),
        Err(error) => unavailable_repository(error.code, error.message),
    };

    DeveloperStatus {
        application_version: APPLICATION_VERSION.into(),
        source_repository,
        release_availability: ReleaseAvailability {
            state: ReleaseAvailabilityState::NotChecked,
            latest_version: None,
            release_url: None,
            checked_at: None,
            error: None,
        },
    }
}

#[tauri::command]
pub async fn developer_status() -> Result<DeveloperStatus, String> {
    tauri::async_runtime::spawn_blocking(|| developer_status_for(source_repository_path()))
        .await
        .map_err(|error| format!("Developer status task failed: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_TEMP_ID: AtomicU64 = AtomicU64::new(1);

    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            let id = NEXT_TEMP_ID.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "jarri-workspace-core-developer-status-{}-{id}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn git(repository: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(repository)
            .args(args)
            .env("GIT_OPTIONAL_LOCKS", "0")
            .output()
            .expect("run git for test fixture");
        assert!(
            output.status.success(),
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn initialized_repository() -> TempDir {
        let temp = TempDir::new();
        git(&temp.0, &["init", "-b", "audit-branch"]);
        git(&temp.0, &["config", "user.name", "Status Test"]);
        git(
            &temp.0,
            &["config", "user.email", "status-test@example.invalid"],
        );
        fs::write(temp.0.join("tracked.txt"), "initial\n").expect("write tracked fixture");
        git(&temp.0, &["add", "tracked.txt"]);
        git(&temp.0, &["commit", "-m", "initial"]);
        temp
    }

    #[test]
    fn reports_branch_short_commit_and_clean_state() {
        let repository = initialized_repository();
        let status = repository_status(&repository.0, Path::new("git"));

        assert!(status.available);
        assert_eq!(status.branch.as_deref(), Some("audit-branch"));
        assert!(!status.detached_head);
        assert_eq!(status.short_commit.as_deref().unwrap().len(), 12);
        assert_eq!(status.working_tree_clean, Some(true));
        assert!(status.error.is_none());
    }

    #[test]
    fn reports_detached_head() {
        let repository = initialized_repository();
        git(&repository.0, &["checkout", "--detach", "HEAD"]);

        let status = repository_status(&repository.0, Path::new("git"));
        assert!(status.available);
        assert_eq!(status.branch, None);
        assert!(status.detached_head);
    }

    #[test]
    fn reports_modified_files_as_dirty() {
        let repository = initialized_repository();
        fs::write(repository.0.join("tracked.txt"), "modified\n").expect("modify fixture");

        let status = repository_status(&repository.0, Path::new("git"));
        assert_eq!(status.working_tree_clean, Some(false));
    }

    #[test]
    fn reports_untracked_files_as_dirty() {
        let repository = initialized_repository();
        fs::write(repository.0.join("untracked.txt"), "untracked\n").expect("write fixture");

        let status = repository_status(&repository.0, Path::new("git"));
        assert_eq!(status.working_tree_clean, Some(false));
    }

    #[test]
    fn reports_missing_repository() {
        let directory = TempDir::new();
        let status = repository_status(&directory.0, Path::new("git"));

        assert!(!status.available);
        assert_eq!(
            status.error.as_ref().map(|error| &error.code),
            Some(&RepositoryStatusErrorCode::NotRepository)
        );
        assert_eq!(status.working_tree_clean, None);
    }

    #[test]
    fn reports_git_command_failure() {
        let repository = initialized_repository();
        let git_program = repository.0.join("git-fails");
        fs::write(
            &git_program,
            "#!/bin/sh\necho intentional failure >&2\nexit 23\n",
        )
        .expect("write fake Git command");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&git_program, fs::Permissions::from_mode(0o755))
                .expect("make fake Git command executable");
        }

        let status = repository_status(&repository.0, &git_program);
        assert!(!status.available);
        assert_eq!(
            status.error.as_ref().map(|error| &error.code),
            Some(&RepositoryStatusErrorCode::CommandFailed)
        );
        assert!(status
            .error
            .unwrap()
            .message
            .contains("intentional failure"));
    }

    #[test]
    fn reports_missing_git_installation() {
        let repository = initialized_repository();
        let missing_git = repository.0.join("missing-git");

        let status = repository_status(&repository.0, &missing_git);
        assert!(!status.available);
        assert_eq!(
            status.error.as_ref().map(|error| &error.code),
            Some(&RepositoryStatusErrorCode::GitUnavailable)
        );
    }
}
