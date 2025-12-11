package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.protocols.ProtocolPriorityConfig;
import software.amazon.smithy.utils.MapUtils;

@ExtendWith(MockitoExtension.class)
public class TypeScriptSettingsTest {

    // these are mock protocol names.
    ShapeId rpcv2Cbor = ShapeId.from("namespace#rpcv2Cbor");
    ShapeId json1_0 = ShapeId.from("namespace#json1_0");
    ShapeId json1_1 = ShapeId.from("namespace#json1_1");
    ShapeId restJson1 = ShapeId.from("namespace#restJson1");
    ShapeId restXml = ShapeId.from("namespace#restXml");
    ShapeId query = ShapeId.from("namespace#query");
    ShapeId serviceQuery = ShapeId.from("namespace#serviceQuery");
    LinkedHashSet<ShapeId> protocolShapeIds = new LinkedHashSet<>(
        List.of(json1_0, json1_1, restJson1, rpcv2Cbor, restXml, query, serviceQuery)
    );

    @Test
    public void resolvesDefaultService() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build()
        );

        assertThat(settings.getService(), equalTo(ShapeId.from("smithy.example#Example")));
    }

    @Test
    public void defaultsToYarn() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build()
        );

        assertEquals(TypeScriptSettings.PackageManager.YARN, settings.getPackageManager());
    }

    @Test
    public void canBeConfiguredToNpm() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .withMember("packageManager", Node.from("npm"))
                .build()
        );

        assertEquals(TypeScriptSettings.PackageManager.NPM, settings.getPackageManager());
    }

    @ParameterizedTest
    @MethodSource("providePackageDescriptionTestCases")
    void expectPackageDescriptionUpdatedByArtifactType(
        TypeScriptSettings.ArtifactType artifactType,
        String expectedDescription
    ) {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();

        ObjectNode settings = Node.objectNodeBuilder()
            .withMember("service", Node.from("smithy.example#Example"))
            .withMember("package", Node.from("example"))
            .withMember("packageVersion", Node.from("1.0.0"))
            .build();

        final TypeScriptSettings typeScriptSettings = TypeScriptSettings.from(model, settings, artifactType);

        assertEquals(typeScriptSettings.getPackageDescription(), expectedDescription);
    }

    private static Stream<Arguments> providePackageDescriptionTestCases() {
        return Stream.of(
            Arguments.of(TypeScriptSettings.ArtifactType.SSDK, "example server"),
            Arguments.of(TypeScriptSettings.ArtifactType.CLIENT, "example client")
        );
    }

    @Test
    public void resolveServiceProtocolSelectJson(
        @Mock Model model,
        @Mock ServiceShape service,
        @Mock ServiceIndex serviceIndex
    ) {
        TypeScriptSettings subject = new TypeScriptSettings();
        when(model.getKnowledge(any(), any())).thenReturn(serviceIndex);
        ShapeId serviceShapeId = ShapeId.from("namespace#Service");
        when(service.toShapeId()).thenReturn(serviceShapeId);

        // spec case 1.
        when(serviceIndex.getProtocols(service)).thenReturn(MapUtils.of(rpcv2Cbor, null, json1_0, null));
        ShapeId protocol = subject.resolveServiceProtocol(model, service, protocolShapeIds);
        // JS customization has JSON at higher default priority than CBOR.
        assertEquals(json1_0, protocol);
    }

    @Test
    public void resolveServiceProtocolSelectOnlyOption(
        @Mock Model model,
        @Mock ServiceShape service,
        @Mock ServiceIndex serviceIndex
    ) {
        TypeScriptSettings subject = new TypeScriptSettings();
        when(model.getKnowledge(any(), any())).thenReturn(serviceIndex);
        ShapeId serviceShapeId = ShapeId.from("namespace#Service");
        when(service.toShapeId()).thenReturn(serviceShapeId);

        // spec case 2.
        when(serviceIndex.getProtocols(service)).thenReturn(MapUtils.of(rpcv2Cbor, null));
        ShapeId protocol = subject.resolveServiceProtocol(model, service, protocolShapeIds);
        assertEquals(rpcv2Cbor, protocol);
    }

    @Test
    public void resolveServiceProtocolSelectJsonOverQueryAndCbor(
        @Mock Model model,
        @Mock ServiceShape service,
        @Mock ServiceIndex serviceIndex
    ) {
        TypeScriptSettings subject = new TypeScriptSettings();
        when(model.getKnowledge(any(), any())).thenReturn(serviceIndex);
        ShapeId serviceShapeId = ShapeId.from("namespace#Service");
        when(service.toShapeId()).thenReturn(serviceShapeId);

        // spec case 3.
        when(serviceIndex.getProtocols(service)).thenReturn(MapUtils.of(rpcv2Cbor, null, json1_0, null, query, null));
        ShapeId protocol = subject.resolveServiceProtocol(model, service, protocolShapeIds);
        // JS customization has JSON at higher default priority than CBOR.
        assertEquals(json1_0, protocol);
    }

    @Test
    public void resolveServiceProtocolSelectJsonOverQuery(
        @Mock Model model,
        @Mock ServiceShape service,
        @Mock ServiceIndex serviceIndex
    ) {
        TypeScriptSettings subject = new TypeScriptSettings();
        when(model.getKnowledge(any(), any())).thenReturn(serviceIndex);
        ShapeId serviceShapeId = ShapeId.from("namespace#Service");
        when(service.toShapeId()).thenReturn(serviceShapeId);

        // spec case 4.
        when(serviceIndex.getProtocols(service)).thenReturn(MapUtils.of(json1_0, null, query, null));
        ShapeId protocol = subject.resolveServiceProtocol(model, service, protocolShapeIds);
        assertEquals(json1_0, protocol);
    }

    @Test
    public void resolveServiceProtocolSelectQueryWhenSingularOption(
        @Mock Model model,
        @Mock ServiceShape service,
        @Mock ServiceIndex serviceIndex
    ) {
        TypeScriptSettings subject = new TypeScriptSettings();
        when(model.getKnowledge(any(), any())).thenReturn(serviceIndex);
        ShapeId serviceShapeId = ShapeId.from("namespace#Service");
        when(service.toShapeId()).thenReturn(serviceShapeId);

        // spec case 5.
        when(serviceIndex.getProtocols(service)).thenReturn(MapUtils.of(query, null));
        ShapeId protocol = subject.resolveServiceProtocol(model, service, protocolShapeIds);
        assertEquals(query, protocol);
    }

    @Test
    public void resolveServiceProtocolSelectServiceCustomPriority(
        @Mock Model model,
        @Mock ServiceShape service,
        @Mock ServiceIndex serviceIndex
    ) {
        TypeScriptSettings subject = new TypeScriptSettings();
        when(model.getKnowledge(any(), any())).thenReturn(serviceIndex);
        ShapeId serviceShapeId = ShapeId.from("namespace#Service");
        when(service.toShapeId()).thenReturn(serviceShapeId);

        // service override, non-spec
        when(serviceIndex.getProtocols(service)).thenReturn(
            MapUtils.of(
                json1_0,
                null,
                json1_1,
                null,
                restJson1,
                null,
                rpcv2Cbor,
                null,
                restXml,
                null,
                query,
                null,
                serviceQuery,
                null
            )
        );
        subject.setProtocolPriority(
            new ProtocolPriorityConfig(
                MapUtils.of(serviceShapeId, List.of(serviceQuery, rpcv2Cbor, json1_1, restJson1, restXml, query)),
                null
            )
        );
        ShapeId protocol = subject.resolveServiceProtocol(model, service, protocolShapeIds);
        assertEquals(serviceQuery, protocol);
    }

    @Test
    public void resolveServiceProtocolSelectDefaultCustomPriority(
        @Mock Model model,
        @Mock ServiceShape service,
        @Mock ServiceIndex serviceIndex
    ) {
        TypeScriptSettings subject = new TypeScriptSettings();
        when(model.getKnowledge(any(), any())).thenReturn(serviceIndex);
        ShapeId serviceShapeId = ShapeId.from("namespace#Service");
        when(service.toShapeId()).thenReturn(serviceShapeId);

        // global default override
        when(serviceIndex.getProtocols(service)).thenReturn(
            MapUtils.of(
                json1_0,
                null,
                json1_1,
                null,
                restJson1,
                null,
                rpcv2Cbor,
                null,
                restXml,
                null,
                query,
                null,
                serviceQuery,
                null
            )
        );
        subject.setProtocolPriority(
            new ProtocolPriorityConfig(null, List.of(rpcv2Cbor, json1_1, restJson1, restXml, query))
        );
        ShapeId protocol = subject.resolveServiceProtocol(model, service, protocolShapeIds);
        assertEquals(rpcv2Cbor, protocol);
    }

    @Test
    public void parseProtocolPriorityJson() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();

        ObjectNode settings = Node.objectNodeBuilder()
            .withMember("service", Node.from("smithy.example#Example"))
            .withMember("package", Node.from("example"))
            .withMember("packageVersion", Node.from("1.0.0"))
            .withMember(
                "serviceProtocolPriority",
                Node.parse(
                    """
                    {
                      "namespace#Service1": ["namespace#Protocol1", "namespace#Protocol2"],
                      "namespace#Service2": ["namespace#Protocol2", "namespace#Protocol1"]
                    }
                    """
                )
            )
            .withMember(
                "defaultProtocolPriority",
                Node.parse(
                    """
                    ["namespace#Protocol3", "namespace#Protocol4"]
                    """
                )
            )
            .build();

        final TypeScriptSettings subject = TypeScriptSettings.from(model, settings);

        assertEquals(
            ShapeId.from("namespace#Protocol2"),
            subject.getProtocolPriority().getProtocolPriority(ShapeId.from("namespace#Service1")).get(1)
        );
        assertEquals(
            ShapeId.from("namespace#Protocol2"),
            subject.getProtocolPriority().getProtocolPriority(ShapeId.from("namespace#Service2")).get(0)
        );
        assertEquals(
            ShapeId.from("namespace#Protocol4"),
            subject.getProtocolPriority().getProtocolPriority(ShapeId.from("namespace#Service5")).get(1)
        );
    }

    @Test
    public void resolvesSupportProtocols() {
        // TODO
    }

    @Test
    public void defaultsApplicationProtocolToHttp() {
        // TODO
    }

    @Test
    public void throwsWhenProtocolsAreNotCoherent() {
        // TODO
    }
}
