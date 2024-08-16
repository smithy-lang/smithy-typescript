/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import software.amazon.smithy.model.shapes.ShapeId;


/**
 * Allows customization of protocol selection for specific services or a global default ordering.
 */
public final class ProtocolPriority {
    private static final Map<ShapeId, List<ShapeId>> SERVICE_PROTOCOL_PRIORITY_CUSTOMIZATIONS = new HashMap<>();
    private static List<ShapeId> customDefaultPriority = null;

    private ProtocolPriority() {}

    /**
     * @param serviceShapeId - service scope.
     * @param protocolPriorityOrder - priority order of protocols.
     */
    public static void setProtocolPriority(ShapeId serviceShapeId, List<ShapeId> protocolPriorityOrder) {
        SERVICE_PROTOCOL_PRIORITY_CUSTOMIZATIONS.put(serviceShapeId, protocolPriorityOrder);
    }

    /**
     * @param defaultProtocolPriorityOrder - use for all services that don't have a more specific priority order.
     */
    public static void setCustomDefaultProtocolPriority(List<ShapeId> defaultProtocolPriorityOrder) {
        customDefaultPriority = new ArrayList<>(defaultProtocolPriorityOrder);
    }

    /**
     * @param serviceShapeId - service scope.
     * @return priority order of protocols or null if no override exists.
     */
    public static List<ShapeId> getProtocolPriority(ShapeId serviceShapeId) {
        return SERVICE_PROTOCOL_PRIORITY_CUSTOMIZATIONS.getOrDefault(
            serviceShapeId,
            customDefaultPriority != null ? new ArrayList<>(customDefaultPriority) : null
        );
    }

    /**
     * @param serviceShapeId - to unset.
     */
    public static void deleteProtocolPriority(ShapeId serviceShapeId) {
        SERVICE_PROTOCOL_PRIORITY_CUSTOMIZATIONS.remove(serviceShapeId);
    }

    /**
     * Unset the custom default priority order.
     */
    public static void deleteCustomDefaultProtocolPriority() {
        customDefaultPriority = null;
    }
}
