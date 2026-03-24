# Contributing to Sanctifier

Thanks for helping improve Sanctifier.

## Required repository secrets

### `CODECOV_TOKEN`

The CI workflow uploads the `cobertura.xml` coverage report to Codecov by using
`codecov/codecov-action@v4.6.0` pinned to an immutable commit SHA.

To configure the token:

1. Open the Sanctifier repository on GitHub.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Create a new repository secret named `CODECOV_TOKEN`.
4. Copy the upload token for `HyperSafeD/Sanctifier` from [Codecov](https://codecov.io/).

Without this secret, the coverage upload step will fail to authenticate.
