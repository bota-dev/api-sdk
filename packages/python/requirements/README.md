# Frozen Python dependency inputs

`policy.json` records exact public release metadata and reviewed wheel hashes.
`runtime.txt` pins the ten-package runtime closure on Python 3.12; the conditional
typing extension is absent on 3.13 and later. `qualification.txt` adds only
flit_core 4.1.0 and ty 0.0.90. No extras or source-build fallback are selected.

Use an explicit virtual environment and `tools/install_dependencies.py` with
an absolute wheelhouse path. `--fetch` explicitly downloads reviewed public
wheels; installation then runs offline with all hashes required and dependency
checking. Reusing an unknown or changed wheel refuses. Child processes retain
only operating-system variables, force `NETRC` to the null device, disable pip
keyring providers, force proxy bypass with `NO_PROXY=*`, and disable ambient pip
configuration. The proxy bypass also prevents Requests from consulting Windows
system proxy settings; its installed-pip utility path is checked without reading
those settings. Removing `HOME` alone
does not disable pip's netrc lookup on Linux. A synthetic loopback test checks
the installed pip's authentication behavior without reading a real netrc file.

The installed gate binds names, versions, license and dependency declarations
to this snapshot. Declaration comparison ignores spacing between bounded
tokens while preserving names, operators, markers and quoted strings; this
handles PyPI/wheel formatting without interpreting arbitrary PEP 508 syntax.
Unknown or extra distributions refuse. The CPython venv seed pip
installer is outside the SDK dependency closure and is reported separately.
Normal runtime consumers do not need the build backend or type checker.

The fixed reviewed licenses are MIT, Apache-2.0, their conjunction, BSD-3-Clause
and PSF-2.0. This gate supports these exact declarations, with narrowly defined
legacy metadata spelling/classifiers; it is not a general SPDX parser. No
package receives a license exception. [PSF-2.0](https://spdx.org/licenses/PSF-2.0.html)
is the permissive license declared by aiohappyeyeballs and typing_extensions.
Each dependency retains its own license and notices; the SDK's MIT license
does not replace them.

The [aiohttp release](https://pypi.org/pypi/aiohttp/3.14.5/json),
[flit_core release](https://pypi.org/pypi/flit_core/4.1.0/json) and
[ty release](https://pypi.org/pypi/ty/0.0.90/json) metadata are primary inputs.
The checker uses the MIT ty distribution with no Python dependencies; mypy's
pathspec and HTTPX's certifi would introduce MPL dependencies under the current
license policy. This choice does not certify native transport or typing: actual
runtime, positive/negative type and packed-consumer checks remain mandatory.

Refreshing metadata is an explicit dependency change: run
`python -I tools/dependencies.py --refresh`, review every source/license/hash
change, and repeat installed and package qualification. The normal `--check`
mode performs no network access.
