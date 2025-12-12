/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.validation;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.neighbor.Walker;
import software.amazon.smithy.model.shapes.LongShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.validation.AbstractValidator;
import software.amazon.smithy.model.validation.ValidationEvent;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.utils.OptionalUtils;

/**
 * This emits a DANGER validation event for any Long shape in the model
 * connected to a service. This is because a long can't be properly supported
 * by the number type in JavaScript.
 *
 * This validator is deliberately not registered to be automatically run. It
 * is run explicitly for SSDK generation.
 */
public final class LongValidator extends AbstractValidator {

    private TypeScriptSettings settings;

    public LongValidator(TypeScriptSettings settings) {
        this.settings = settings;
    }

    @Override
    public List<ValidationEvent> validate(Model model) {
        ServiceShape service = model.expectShape(settings.getService(), ServiceShape.class);
        Set<LongShape> longs = new Walker(model)
            .walkShapes(service)
            .stream()
            .flatMap(shape -> OptionalUtils.stream(shape.asLongShape()))
            .collect(Collectors.toSet());

        return longs
            .stream()
            .map(
                shape -> warning(
                    shape,
                    "JavaScript numbers are all IEEE-754 double-precision floats. As a " +
                        "consequence of this, the maximum safe value for integral numbers is 2^53 - 1. Since a "
                        +
                        "long shape can have values up to 2^63 - 1, there is a significant range of values that "
                        +
                        "cannot be safely represented in JavaScript. If possible, use the int shape. If values "
                        +
                        "outside of the safe range of JavaScript integrals are needed, it is recommended to use a "
                        +
                        "string shape instead."
                )
            )
            .collect(Collectors.toList());
    }
}
