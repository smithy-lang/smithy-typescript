/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.nio.file.Paths;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Represents a possible language target that can be generated.
 */
@SmithyUnstableApi
public enum LanguageTarget {
    /**
     * Node-specific language target.
     */
    NODE {
        @Override
        String getTemplateFileName() {
            return "runtimeConfig.ts.template";
        }
    },

    /**
     * Browser-specific language target.
     */
    BROWSER {
        @Override
        String getTemplateFileName() {
            return "runtimeConfig.browser.ts.template";
        }
    },

    /**
     * ReactNative-specific language target.
     * Note: ReactNative target extends from Browser target. You only need to add
     * ReactNative dependencies if they are different to Browser dependencies.
     */
    REACT_NATIVE {
        @Override
        String getTemplateFileName() {
            return "runtimeConfig.native.ts.template";
        }
    },

    /**
     * A language target that shares configuration that is shared across all
     * runtimes.
     */
    SHARED {
        @Override
        String getTemplateFileName() {
            return "runtimeConfig.shared.ts.template";
        }
    };

    abstract String getTemplateFileName();

    String getTargetFilename() {
        return Paths.get(CodegenUtils.SOURCE_FOLDER, getTemplateFileName().replace(".template", "")).toString();
    }
}
