/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.rulesengine.language.EndpointRuleSet;
import software.amazon.smithy.rulesengine.logic.bdd.CostOptimization;
import software.amazon.smithy.rulesengine.logic.bdd.NodeReversal;
import software.amazon.smithy.rulesengine.logic.bdd.SiftingOptimization;
import software.amazon.smithy.rulesengine.logic.cfg.Cfg;
import software.amazon.smithy.rulesengine.traits.EndpointBddTrait;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * We use this to convert the endpointRuleSet into BDD only when the
 * model does not have the trait already, and the available transforms were not applied.
 */
@SmithyUnstableApi
@SmithyInternalApi
public final class ConvertBdd {
    private ConvertBdd() {}

    public static EndpointBddTrait convert(Model model, TypeScriptSettings settings) {
        ServiceShape service = settings.getService(model);
        EndpointRuleSetTrait ruleSetTrait = service.expectTrait(EndpointRuleSetTrait.class);
        EndpointRuleSet ruleSet = ruleSetTrait.getEndpointRuleSet();

        Cfg cfg = Cfg.from(ruleSet);
        EndpointBddTrait bddTrait = EndpointBddTrait.from(cfg);
        bddTrait = SiftingOptimization.builder().cfg(cfg).build().apply(bddTrait);
        bddTrait = CostOptimization.builder().cfg(cfg).build().apply(bddTrait);
        bddTrait = new NodeReversal().apply(bddTrait);

        return bddTrait;
    }
}
