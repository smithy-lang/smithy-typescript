/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import software.amazon.smithy.model.shapes.ShapeId;

/**
 * Allows customization of protocol selection for specific services or a global default ordering.
 */
public final class ProtocolPriorityConfig {
  private final Map<ShapeId, List<ShapeId>> serviceProtocolPriorityCustomizations;
  private final List<ShapeId> customDefaultPriority;

  public ProtocolPriorityConfig(
      Map<ShapeId, List<ShapeId>> serviceProtocolPriorityCustomizations,
      List<ShapeId> customDefaultPriority) {
    this.serviceProtocolPriorityCustomizations =
        Objects.requireNonNullElseGet(serviceProtocolPriorityCustomizations, HashMap::new);
    this.customDefaultPriority = customDefaultPriority;
  }

  /**
   * @param serviceShapeId - service scope.
   * @return priority order of protocols or null if no override exists.
   */
  public List<ShapeId> getProtocolPriority(ShapeId serviceShapeId) {
    return serviceProtocolPriorityCustomizations.getOrDefault(
        serviceShapeId,
        customDefaultPriority != null ? new ArrayList<>(customDefaultPriority) : null);
  }
}
