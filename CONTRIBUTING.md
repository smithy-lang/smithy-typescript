# Contributing Guidelines

Thank you for your interest in contributing to our project. Whether it's a bug report, new feature, correction, or additional
documentation, we greatly value feedback and contributions from our community.

Please read through this document before submitting any issues or pull requests to ensure we have all the necessary
information to effectively respond to your bug report or contribution.

## Gradle Composite Build
The `smithy-typescript` repository uses Gradle as a build tool and has Gradle based dependencies such as `smithy`.
To improve development experience when making changes to the dependencies locally, we can
use the [Gradle composite build feature](https://docs.gradle.org/current/userguide/composite_builds.html),
which allows picking up any local changes from dependencies automatically and rebuilding them when `smithy-typescript` is rebuilt.

This also makes IDE integration more pleasant, as Intellij IDEA will open the included projects as modules when the Gradle build is imported.

In order to utilise this feature, create a file `local.properties` in the project directory with the following content:

```
smithy=/Volumes/workplace/smithy
```

## Experimental Features

The `smithy-typescript` repository is under heavy development, and has experimental features that can affect consumers
of code generation packages and TypeScript packages. These features are enabled via opt-in settings in
`smithy-build.json`. Note that any contributions related to these features MUST be reviewed carefully for opt-in
behavior via feature flags as to not break any existing customers. Here are the experimental features that are currently
under development:

Experimental Feature | Flag                          | Description
---------------------|-------------------------------|------------
Identity & Auth      | `experimentalIdentityAndAuth` | Standardize identity and auth integrations to match the Smithy specification (see [Authentication Traits](https://smithy.io/2.0/spec/authentication-traits.html)). Newer capabilities include support for multiple auth schemes, `@optionalAuth`, and standardized identity interfaces for authentication schemes both in code generation and TypeScript packages. In `smithy-typescript`, `@httpApiKeyAuth` will be updated to use the new standardized interfaces. In `aws-sdk-js-v3` (`smithy-typescript`'s largest customer), this will affect `@aws.auth#sigv4` and `@httpBearerAuth` implementations, but is planned to be completely backwards-compatible.

## Reporting Bugs/Feature Requests

We welcome you to use the GitHub issue tracker to report bugs or suggest features.

When filing an issue, please check [existing open](https://github.com/awslabs/smithy-typescript/issues), or [recently closed](https://github.com/awslabs/smithy-typescript/issues?utf8=%E2%9C%93&q=is%3Aissue%20is%3Aclosed%20), issues to make sure somebody else hasn't already
reported the issue. Please try to include as much information as you can. Details like these are incredibly useful:

* A reproducible test case or series of steps
* The version of our code being used
* Any modifications you've made relevant to the bug
* Anything unusual about your environment or deployment


## Contributing via Pull Requests
Contributions via pull requests are much appreciated. Before sending us a pull request, please ensure that:

1. You are working against the latest source on the *main* branch.
2. You check existing open, and recently merged, pull requests to make sure someone else hasn't addressed the problem already.
3. You open an issue to discuss any significant work - we would hate for your time to be wasted.

To send us a pull request, please:

1. Fork the repository.
2. Modify the source; please focus on the specific change you are contributing. If you also reformat all the code, it will be hard for us to focus on your change.
3. Ensure local tests pass.
4. Commit to your fork using clear commit messages.
5. Send us a pull request, answering any default questions in the pull request interface.
6. Pay attention to any automated CI failures reported in the pull request, and stay involved in the conversation.

If you are modifying one or more of the NPM packages in the `/packages` directory please follow these additional steps before opening a pull request:

1. After modifying the source, run `yarn changeset add`.
2. Follow the prompts and select the appropriate change level (`major`, `minor` or `patch`) for each of the NPM packages you have modified.
3. Add the generated changeset file to your commit: `git add .changeset/<generated file name>.md`.
4. Commit to your fork using clear commit messages.
5. Send the pull request.

GitHub provides additional document on [forking a repository](https://help.github.com/articles/fork-a-repo/) and
[creating a pull request](https://help.github.com/articles/creating-a-pull-request/).


## Finding contributions to work on
Looking at the existing issues is a great way to find something to contribute on. As our projects, by default, use the default GitHub issue labels (enhancement/bug/duplicate/help wanted/invalid/question/wontfix), looking at any ['help wanted'](https://github.com/awslabs/smithy-typescript/labels/help%20wanted) issues is a great place to start.


## Code of Conduct
This project has adopted the [Amazon Open Source Code of Conduct](https://aws.github.io/code-of-conduct).
For more information see the [Code of Conduct FAQ](https://aws.github.io/code-of-conduct-faq) or contact
opensource-codeofconduct@amazon.com with any additional questions or comments.


## Security issue notifications
If you discover a potential security issue in this project we ask that you notify AWS/Amazon Security via our [vulnerability reporting page](http://aws.amazon.com/security/vulnerability-reporting/). Please do **not** create a public github issue.


## Licensing

See the [LICENSE](https://github.com/awslabs/smithy-typescript/blob/main/LICENSE) file for our project's licensing. We will ask you to confirm the licensing of your contribution.

We may ask you to sign a [Contributor License Agreement (CLA)](http://en.wikipedia.org/wiki/Contributor_License_Agreement) for larger changes.
