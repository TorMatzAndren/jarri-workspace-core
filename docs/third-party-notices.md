# Third-Party Notices and Licensing Inventory

This inventory records known contributions, assets, and external dependencies
in the Core repository. The project owner confirms that original Core and
Workspace Lab code, architectural implementations, branding, graphical assets,
icons, and screenshots are owned by the owner or available under rights
sufficient for the Core MPL-2.0 release. The owner also confirms that Kenny
(Sh0ken), a Workspace collaborator, granted rights to incorporate, modify,
distribute, and license his contributions in Core under MPL-2.0. Dependencies
and independently licensed components retain their own applicable terms; this
inventory does not relicense them.

## Identified contributions and assets

| Item | Repository evidence | License / status |
| --- | --- | --- |
| Workspace Lab-derived implementation | Core history includes `d039c82` (“Sync generic Workspace substrate from Lab”), `9120cb5` (“Port opt-in virtual list infrastructure from Workspace Lab”), and subsequent Lab-derived promotions. The Lab history traces to a Workspace Core seed; the import commits and inspected Lab history use the project owner's identity. | The project owner confirms ownership or sufficient rights for the original Core/Lab code and architectural implementations, including release under MPL-2.0. No additional third-party source or notice was identified in the imported generic runtime and presentation files. |
| Dashboard Night (UX Planet) palette | `src/styles.css`, `src/panels/ThemeColorsPanel.tsx`, and `CHANGELOG.md` attribute the community theme to Sh0ken (Kenny). CSS names `dashboard-night-ux-planet.jarri-theme.json`; that original file is not included in this repository. | Kenny's contribution and rights to incorporate, modify, distribute, and license it in Core under MPL-2.0 are confirmed by the project owner. Attribution is retained. The cited original source file is not bundled. |
| Rounded-corner controls | `src/panels/ThemeColorsPanel.tsx` attributes the panel frame radius control to Kenny / Sh0ken; Core history contains the implementation. | Kenny's rights to incorporate, modify, distribute, and license the contribution in Core under MPL-2.0 are confirmed. Attribute the original contribution to Kenny; later adjustments remain Core work. |
| Organize concept and original implementation | Core spatial-workspace history and release documentation record Kenny / Sh0ken's initial Organize concept and implementation. | Kenny's rights to incorporate, modify, distribute, and license the contribution in Core under MPL-2.0 are confirmed. Subsequent spatial planning, correctness repairs, lock support, and integration are Core development and are not attributed exclusively to Kenny. |
| ChronoGit-named appearance preset | `src/panels/ThemeColorsPanel.tsx` and `src/styles.css` include the `chronogit` preset, adapting the visual style used in ChronoGit. Core contains no ChronoGit source code or logo asset. | The project owner confirms sufficient rights for the branding and graphical styling included in Core's MPL-2.0 release, including use of the preset identity in this product. MPL-2.0 itself does not grant downstream trademark rights. |
| Jarri Workspace logo | `src/assets/jarri-workspace.png`; introduced in Core's branding history. | The project owner confirms ownership or sufficient rights for its inclusion in the MPL-2.0 release. MPL-2.0 does not grant downstream Jarri trademark rights. |
| Tauri application icons | `src-tauri/icons/` contains PNG, ICO, and ICNS application icons, introduced with the native host. | The project owner confirms ownership or sufficient rights for their inclusion in the MPL-2.0 release. MPL-2.0 does not grant downstream branding rights. |
| Workspace screenshot | `docs/workspace-core-demo.png`, introduced with the Core README. | The project owner confirms ownership or sufficient rights for its inclusion in the source release. |

No bundled font files were found. CSS uses system font-family stacks; those
fonts are supplied by the operating system and are not included in this
repository. The virtual-list benchmark stylesheet names Inter before its
system fallback but does not bundle a font file.

## Package dependencies

The source manifests and lockfiles identify dependencies but do not replace
the licenses or notices shipped by each dependency. The current direct npm
dependencies declare:

| Package | Declared license expression |
| --- | --- |
| `@tauri-apps/api` | Apache-2.0 OR MIT |
| `@tauri-apps/plugin-clipboard-manager` | MIT OR Apache-2.0 |
| `@tauri-apps/plugin-opener` | MIT OR Apache-2.0 |
| `@vitejs/plugin-react` | MIT |
| `modern-screenshot` | MIT |
| `react`, `react-dom` | MIT |
| `typescript` | Apache-2.0 |
| `vite` | MIT |
| `@tauri-apps/cli` | Apache-2.0 OR MIT |
| `@types/react`, `@types/react-dom` | MIT |

The installed build-tool dependency chain also includes `caniuse-lite`, whose
package metadata declares CC-BY-4.0. It is pulled through Browserslist for build
tooling and was not found in the production `dist/` output checked for this
inventory. Its separate attribution/license terms still apply if the package
itself is redistributed.

The locked Rust dependency graph contains 507 packages with license metadata
including MIT, Apache-2.0, BSD, ISC, Unicode-3.0, Zlib, Unlicense, MPL-2.0,
and dual-license expressions. Some crates offer LGPL-2.1-or-later as one of
multiple choices. This is a metadata inventory, not a legal compatibility
opinion or a complete reproduction of every dependency's required notice.
Preserve each dependency's own license terms when distributing an application
bundle. Neither npm nor Cargo dependency license metadata is changed by the
Core MPL-2.0 declaration.

## Distribution scope

The project owner confirms rights sufficient to release the identified
first-party code and assets, including the named Kenny contributions, under
MPL-2.0. Keep the attribution above and retain separate licenses and notices
for dependencies and independently licensed components. The MPL declaration
does not by itself grant rights to third-party trademarks or branding beyond
the rights the project owner has confirmed for inclusion in Core.
