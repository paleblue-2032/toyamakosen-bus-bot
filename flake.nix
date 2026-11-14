{
  description = "Toyama Kosen bus location Discord bot";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
    in
    {
      packages = forAllSystems (pkgs: {
        default = pkgs.buildNpmPackage {
          pname = "toyamakosen-bus-bot";
          version = "0.1.0";
          src = ./.;
          nodejs = pkgs.nodejs_22;
          npmDepsHash = "sha256-dlGRgGyo7TmlEoB9uTEyNuHY8D4Y2G+/icaxT4OERqU=";
          npmBuildScript = "build";
          nativeBuildInputs = [ pkgs.makeWrapper ];
          installPhase = ''
            runHook preInstall
            mkdir -p $out/lib/toyamakosen-bus-bot
            cp -a dist node_modules package.json $out/lib/toyamakosen-bus-bot/
            mkdir -p $out/bin
            makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/toyamakosen-bus-bot \
              --add-flags "$out/lib/toyamakosen-bus-bot/dist/index.js"
            runHook postInstall
          '';
        };
      });

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.git
          ];
        };
      });

      apps = forAllSystems (pkgs: {
        default = {
          type = "app";
          program = "${self.packages.${pkgs.system}.default}/bin/toyamakosen-bus-bot";
        };
      });
    };
}
