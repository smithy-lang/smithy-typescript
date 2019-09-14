/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package software.amazon.smithy.typescript.codegen;

/**
 * Specifies the target environment where JavaScript code is run.
 */
public enum TypeScriptTarget {
    /**
     * Symbols are used in the browser, meaning things like Node streams
     * can't be used.
     */
    BROWSER,

    /**
     * Symbols are used in Node, meaning things like Node streams can
     * be used.
     */
    NODE,

    /**
     * Symbols are meant to operate with both Node and the browser.
     */
    UNIVERSAL
}
