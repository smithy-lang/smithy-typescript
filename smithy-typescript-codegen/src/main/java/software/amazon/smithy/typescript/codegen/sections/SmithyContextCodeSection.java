/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.sections;

import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyUnstableApi;

@SmithyUnstableApi
public final class SmithyContextCodeSection implements CodeSection {
    private final ServiceShape service;
    private final OperationShape operation;

    private SmithyContextCodeSection(Builder builder) {
        service = SmithyBuilder.requiredState("service", builder.service);
        operation = SmithyBuilder.requiredState("operation", builder.operation);
    }

    public ServiceShape getService() {
        return service;
    }

    public OperationShape getOperation() {
        return operation;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder implements SmithyBuilder<SmithyContextCodeSection> {
        private ServiceShape service;
        private OperationShape operation;

        @Override
        public SmithyContextCodeSection build() {
            return new SmithyContextCodeSection(this);
        }

        public Builder service(ServiceShape service) {
            this.service = service;
            return this;
        }

        public Builder operation(OperationShape operation) {
            this.operation = operation;
            return this;
        }
    }
}
