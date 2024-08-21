/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.util;

import java.util.Objects;
import software.amazon.smithy.model.node.ObjectNode;


public final class MergeJsonNodes {

    private MergeJsonNodes() {}

    /**
     * @param left - original node.
     * @param right - overwriting node.
     * @return new node with shallow merged fields except the recursively merged "scripts" field.
     */
    public static ObjectNode mergeWithScripts(ObjectNode left, ObjectNode right) {
        Objects.requireNonNull(left);
        Objects.requireNonNull(right);

        ObjectNode.Builder merged = left.toBuilder();
        right.getMembers().forEach((k, v) -> {
            String key = k.getValue();
            if (left.containsMember(key)) {
                if (left.getMember(key).get().isObjectNode() && v.isObjectNode() && key.equals("scripts")) {
                    merged.withMember(key,
                        MergeJsonNodes.mergeWithScripts(left.expectObjectMember(key), v.expectObjectNode())
                    );
                } else {
                    merged.withMember(key, v);
                }
            } else {
                merged.withMember(key, v);
            }
        });
        return merged.build();
    }
}
