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
public final class ProtocolPriorityConfig {
    private final Map<ShapeId, List<ShapeId>> serviceProtocolPriorityCustomizations = new HashMap<>();
    private List<ShapeId> customDefaultPriority = null;

    /**
     * @param serviceShapeId - service scope.
     * @param protocolPriorityOrder - priority order of protocols.
     */
    public void setProtocolPriority(ShapeId serviceShapeId, List<ShapeId> protocolPriorityOrder) {
        serviceProtocolPriorityCustomizations.put(serviceShapeId, protocolPriorityOrder);
    }

    /**
     * @param defaultProtocolPriorityOrder - use for all services that don't have a more specific priority order.
     */
    public void setCustomDefaultProtocolPriority(List<ShapeId> defaultProtocolPriorityOrder) {
        customDefaultPriority = new ArrayList<>(defaultProtocolPriorityOrder);
    }

    /**
     * @param serviceShapeId - service scope.
     * @return priority order of protocols or null if no override exists.
     */
    public List<ShapeId> getProtocolPriority(ShapeId serviceShapeId) {
        return serviceProtocolPriorityCustomizations.getOrDefault(
            serviceShapeId,
            customDefaultPriority != null ? new ArrayList<>(customDefaultPriority) : null
        );
    }

    /**
     * @param serviceShapeId - to unset.
     */
    public void deleteProtocolPriority(ShapeId serviceShapeId) {
        serviceProtocolPriorityCustomizations.remove(serviceShapeId);
    }

    /**
     * Unset the custom default priority order.
     */
    public void deleteCustomDefaultProtocolPriority() {
        customDefaultPriority = null;
    }
}
