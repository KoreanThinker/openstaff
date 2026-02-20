#!/usr/bin/env bash
set -euo pipefail

REPO="KoreanThinker/openstaff"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"
INSTALL_DIR="${OPENSTAFF_INSTALL_DIR:-$PWD}"
DOWNLOAD_ONLY="${OPENSTAFF_DOWNLOAD_ONLY:-0}"
REQUESTED_VERSION="${OPENSTAFF_VERSION:-}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd sed
need_cmd uname

os="$(uname -s)"
arch_raw="$(uname -m)"

case "$os" in
  Darwin) platform="macos" ;;
  Linux) platform="linux" ;;
  *)
    echo "Unsupported OS: $os" >&2
    exit 1
    ;;
esac

case "$arch_raw" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64) arch="amd64" ;;
  *)
    echo "Unsupported architecture: $arch_raw" >&2
    exit 1
    ;;
esac

tag="$REQUESTED_VERSION"
if [[ -z "$tag" ]]; then
  tag="$(curl -fsSL "$API_URL" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
fi

if [[ -z "$tag" ]]; then
  echo "Could not resolve latest release tag." >&2
  exit 1
fi

if [[ "$tag" != v* ]]; then
  tag="v${tag}"
fi
version="${tag#v}"

if [[ "$platform" == "macos" ]]; then
  if [[ "$arch" == "arm64" ]]; then
    asset="OpenStaff-${version}-arm64.dmg"
  else
    asset="OpenStaff-${version}.dmg"
  fi
else
  if [[ "$arch" == "arm64" ]]; then
    asset="openstaff_${version}_arm64.deb"
  else
    asset="openstaff_${version}_amd64.deb"
  fi
fi

url="https://github.com/${REPO}/releases/download/${tag}/${asset}"
mkdir -p "$INSTALL_DIR"
asset_path="${INSTALL_DIR}/${asset}"

echo "Downloading ${asset}..."
curl -fL --retry 3 --retry-delay 2 -o "$asset_path" "$url"
echo "Downloaded: ${asset_path}"

if [[ "$DOWNLOAD_ONLY" == "1" ]]; then
  echo "OPENSTAFF_DOWNLOAD_ONLY=1 set. Skipping install step."
  exit 0
fi

if [[ "$platform" == "macos" ]]; then
  need_cmd open
  open "$asset_path"
  echo "Opened DMG. Move OpenStaff.app to /Applications."
  exit 0
fi

if ! command -v dpkg >/dev/null 2>&1; then
  echo "dpkg not found. Downloaded package only: ${asset_path}" >&2
  exit 0
fi

if [[ "$(id -u)" -eq 0 ]]; then
  dpkg -i "$asset_path" || apt-get install -f -y
  echo "Installed ${asset}."
  exit 0
fi

if command -v sudo >/dev/null 2>&1; then
  sudo dpkg -i "$asset_path" || sudo apt-get install -f -y
  echo "Installed ${asset}."
  exit 0
fi

echo "sudo is required to install. Downloaded package only: ${asset_path}" >&2
