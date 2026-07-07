#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NVMRC_PATH="${PROJECT_ROOT}/.nvmrc"

if [[ ! -f "${NVMRC_PATH}" ]]; then
  echo "Missing .nvmrc in ${PROJECT_ROOT}" >&2
  exit 1
fi

REQUESTED_VERSION="$(tr -d '[:space:]' < "${NVMRC_PATH}")"
NVM_VERSIONS_DIR="${HOME}/.nvm/versions/node"

fallback_to_system_node() {
  local system_node=""
  system_node="$(command -v node || true)"

  if [[ -z "${system_node}" ]]; then
    echo "Unable to locate Node ${REQUESTED_VERSION}: NVM is unavailable and no system node was found in PATH" >&2
    exit 1
  fi

  local system_version=""
  system_version="$("${system_node}" -v 2>/dev/null || true)"
  echo "Using system Node ${system_version:-unknown} from ${system_node} because NVM is unavailable" >&2

  export PATH="$(dirname "${system_node}"):${PROJECT_ROOT}/node_modules/.bin:${PATH}"
  exec "$@"
}

if [[ ! -d "${NVM_VERSIONS_DIR}" ]]; then
  echo "Missing NVM versions directory: ${NVM_VERSIONS_DIR}" >&2
  fallback_to_system_node "$@"
fi

find_node_bin() {
  local requested="$1"
  local direct="${NVM_VERSIONS_DIR}/v${requested}/bin/node"

  if [[ -x "${direct}" ]]; then
    printf '%s\n' "${direct}"
    return 0
  fi

  local candidate=""
  local matches=("${NVM_VERSIONS_DIR}"/v"${requested}"*/bin/node)

  if [[ -e "${matches[0]}" ]]; then
    for path in "${matches[@]}"; do
      if [[ -x "${path}" ]]; then
        candidate="${path}"
      fi
    done
  fi

  if [[ -n "${candidate}" ]]; then
    printf '%s\n' "${candidate}"
    return 0
  fi

  return 1
}

NODE_BIN="$(find_node_bin "${REQUESTED_VERSION}")" || {
  echo "Unable to locate Node ${REQUESTED_VERSION} from ${NVM_VERSIONS_DIR}" >&2
  fallback_to_system_node "$@"
}

export PATH="$(dirname "${NODE_BIN}"):${PROJECT_ROOT}/node_modules/.bin:${PATH}"

exec "$@"
