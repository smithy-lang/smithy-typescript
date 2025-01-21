import * as fs from 'fs';
/*
 * Extracts the shape name from a ShapeId.
 * @param shapeId The full ShapeId
 * @return The extracted shape name
 */
export function getShapeName(shapeId: string): string {
    return shapeId.substring(shapeId.lastIndexOf('#') + 1);
}

/**
 * Represents a Smithy model with utility methods for shape manipulation.
 */
export class Model {
    private readonly model;
    public readonly smithy: string;
    public readonly shapes: Record<string, any>;

    /**
     * Creates a new SmithyModel instance.
     * @param modelPath Path to the model file
     */
    constructor(modelPath: string) {
        this.model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
        this.smithy = this.model['smithy'];
        this.shapes = this.model['shapes'];
    }

    /**
     * Finds shapes matching the given type.
     * @param type Shape type to search for
     * @return Record of shapes matching the given type
     */
    public findShapes(type: string): Record<string, any> {
        const shapes: Record<string, any> = {};
        for (const [key, value] of Object.entries(this.shapes)) {
            if (value.type === type) {
                shapes[key] = value;
            }
        }
        return shapes;
    }

    /**
     * Gets the ServiceShape matching the given shapeId.
     * @param shapeId ShapeId of the service shape
     * @return ServiceShape matching the given shapeId
     */
    public getService(shapeId: string) {
        return this.findShapes("service")[shapeId];
    }

    /**
     * Gets the ResourceShape matching the given shapeId.
     * @param shapeId ShapeId of the resource shape
     * @return ResourceShape matching the given shapeId
     */
    public getResource(shapeId: string) {
        return this.findShapes("resource")[shapeId];
    }

    /**
     * Groups operations by resource.
     * @return Record of operations grouped by resource
     */
    public groupOperationsByResource(): Record<string, any[]> {
        const operationsByResource: Record<string, any[]> = {};

        for (const [resourceId, resourceShape] of Object.entries(this.findShapes("resource"))) {
            const operations = [];

            // Add CRUD and list operations if present
            for (const opType of ['create', 'read', 'update', 'delete', 'list'] as const) {
                if (resourceShape[opType]) {
                    operations.push(resourceShape[opType]!);
                }
            }

            // Add other operations if present
            if (resourceShape.operations) {
                operations.push(...resourceShape.operations);
            }

            operationsByResource[resourceId] = operations;
        }

        return operationsByResource;
    }
}