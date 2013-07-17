#!/bin/bash
set -e

function log () {
  echo "$@" >&2
}

TMP_TAR="/tmp/conductance-bootstrap-$$.tar.gz"
function cleanup () {
  log "Install failed."
  if [ -e "$TMP_TAR" ]; then
    rm -f "$TMP_TAR"
  fi
}

trap cleanup EXIT

# OS Check. Put here because here is where we download the precompiled
# bundles that are arch specific.
UNAME=$(uname)
if [ "$UNAME" != "Linux" -a "$UNAME" != "Darwin" ] ; then
    log "Sorry, this OS is not supported."
    exit 1
fi

if [ "$UNAME" = "Darwin" ] ; then
    OS=osx
    if [ "i386" != "$(uname -p)" -o "1" != "$(sysctl -n hw.cpu64bit_capable 2>/dev/null || echo 0)" ] ; then

        # Can't just test uname -m = x86_64, because Snow Leopard can
        # return other values.
        log "Only 64-bit Intel processors are supported at this time."
        exit 1
    fi
elif [ "$UNAME" = "Linux" ] ; then
    OS=linux
    arch="$(uname -m)"
    if [ "$arch" != "x86_64" ] ; then
        log "Unsupported architecture: $ARCH"
        log "Conductance only supports i686 and x86_64 for now."
        exit 1
    fi
fi
PLATFORM="${OS}_x64"

DEST="$HOME/.conductance"
if [ "$#" -gt 0 ]; then
  DEST="$1"
fi

if [ -e "$DEST" ]; then
  log "This installer will REMOVE the existing contents at $DEST"
  log "Continue? [y/N]"
  read res
  if [ 'y' = "$res" -o Y = "$res" ]; then
    true
  else
    log "Cancelled."
    trap - EXIT
    exit 1
  fi
fi

log "Installing to $DEST ..."

TARBALL="${PLATFORM}.tar.gz"
URL="http://onilabs.com/conductance/$TARBALL"
log "Downloading $URL ..."
curl -# "$URL" -o "$TMP_TAR"

# dry-run unpacking to /dev/null, to make sure entire file is present
if tar -xzf "$TMP_TAR" --to-stdout >/dev/null; then
  true
else
  log "Archive corrupted - try running this installer again later."
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
tar -xzf "$TMP_TAR" -C "$DEST"
rm -f "$TMP_TAR"
trap - EXIT
exec bash "$DEST/share/boot.sh"
