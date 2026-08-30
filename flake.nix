{
  description = "mc-noise: Seeded deterministic noise, portable Minecraft density functions, and sampling primitives. The seed -> value interface is a versioned contract.";

  inputs = {
    # nixos-unstable, not nixpkgs-unstable: it advances only after the NixOS
    # release tests pass, so it is less likely to land a broken build.
    #
    # flake.lock is pinned to revision 624af665 (nixpkgs's oxlint 1.75.0):
    # channel revisions from roughly 2026-08 onward ship oxlint >=1.79.0,
    # whose `no-redeclare` rule misfires on the `type X = ... & Brand<...>` +
    # `const X = Brand.refined(...)` idiom used throughout this org's Effect
    # code (proven A/B on an identical tree: 1.75.0 -> 0 warnings, 1.79.0 ->
    # 59). Re-check this pin on the next toolchain wave.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      # Only what is actually exercised: x86_64-linux by CI, aarch64-darwin by
      # the maintainer. Declaring a platform nothing builds makes
      # `nix flake check --all-systems` fail rather than skip it.
      systems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      pkgsFor = system: nixpkgs.legacyPackages.${system};
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          # Node 24 matches the `engines` field and the CI runner. pnpm comes
          # from corepack rather than nixpkgs so that the version is decided by
          # the `packageManager` field in package.json — one source of truth
          # instead of two that can drift.
          #
          # oxlint is intentionally Nix-provided rather than a package.json
          # dependency, so the development shell supplies one lockfile-backed
          # lint binary across supported platforms.
          #
          # ast-grep covers what oxlint cannot: it implements none of
          # no-restricted-syntax, no-restricted-properties or
          # no-restricted-globals, so the org-wide ban on reading a
          # process-global clock had no mechanical gate before this.
          # `.ast-grep/rules/` holds that gate.
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_24
              pkgs.corepack_24
              pkgs.typescript-language-server
              pkgs.oxlint
              pkgs.ast-grep
            ];

            shellHook = ''
              corepackDir="$(mktemp -d "''${TMPDIR:-/tmp}/mc-noise-corepack.XXXXXX")"
              corepack enable --install-directory "$corepackDir"
              export PATH="$corepackDir:$PATH"
            '';
          };
        }
      );
    };
}
