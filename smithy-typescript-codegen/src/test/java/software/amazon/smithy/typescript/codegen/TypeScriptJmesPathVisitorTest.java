package software.amazon.smithy.typescript.codegen;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.jmespath.JmespathExpression;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

public class TypeScriptJmesPathVisitorTest {

    private String generateTypescriptInterpretation(String path) {
        TypeScriptWriter writer = new TypeScriptWriter("test");

        JmespathExpression expression = JmespathExpression.parse(path);
        expression.parse(path);
        TypeScriptJmesPathVisitor visitor = new TypeScriptJmesPathVisitor(writer, "result", expression);
        visitor.run();
        String result = writer.toString();
        return result;
    }

    @Test
    public void createsSimpleOneLevelIndex() {
        String result = generateTypescriptInterpretation("foo");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  return result.foo;\n}\n"));
    }

    @Test
    public void createsSimpleTwoLevelIndex() {
        String result = generateTypescriptInterpretation("foo.bar");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  return result.foo.bar;\n}\n"));
    }

    @Test
    public void createsDeepIndex() {
        String result = generateTypescriptInterpretation("foo.bar.car.gar.foo.bar.car");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  return result.foo.bar.car.gar.foo.bar.car;\n}\n"));
    }

    @Test
    public void createsListProfile() {
        String result = generateTypescriptInterpretation("foo.bar[].car");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let flat_1: any[] = [].concat(...result.foo.bar);\n  let projection_3 = flat_1.map((element_2: any) => {\n    return element_2.car;\n  });\n  return projection_3;\n}\n"));
    }

    @Test
    public void createsLengthEqualityCheckProfile() {
        String result = generateTypescriptInterpretation("length(items) == `0`");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  return (result.items.length == 0.0);\n}\n"));
    }

    @Test
    public void createsLengthLessCheckProfile() {
        String result = generateTypescriptInterpretation("length(items) < `0`");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  return (result.items.length < 0.0);\n}\n"));
    }

    @Test
    public void createsLengthGreaterCheckProfile() {
        String result = generateTypescriptInterpretation("length(items) > `0`");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  return (result.items.length > 0.0);\n}\n"));
    }

    @Test
    public void createsDeepLengthCheckProfile() {

        String result = generateTypescriptInterpretation("length(items.foo.deep[]) == `0`");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let flat_1: any[] = [].concat(...result.items.foo.deep);\n  return (flat_1.length == 0.0);\n}\n"));
    }

    @Test
    public void createsDoubleLengthChecksProfile() {
        String result = generateTypescriptInterpretation("length(set.items[].bar[].gar.foo.items[].item) == length(bar.foos[].foo)");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let flat_1: any[] = [].concat(...result.set.items);\n  let projection_3 = flat_1.map((element_2: any) => {\n    return element_2.bar;\n  });\n  let flat_4: any[] = [].concat(...projection_3);\n  let projection_6 = flat_4.map((element_5: any) => {\n    return element_5.gar.foo.items;\n  });\n  let flat_7: any[] = [].concat(...projection_6);\n  let projection_9 = flat_7.map((element_8: any) => {\n    return element_8.item;\n  });\n  let flat_10: any[] = [].concat(...result.bar.foos);\n  let projection_12 = flat_10.map((element_11: any) => {\n    return element_11.foo;\n  });\n  return (projection_9.length == projection_12.length);\n}\n"));
    }

    @Test
    public void createWrapAroundProfile() {
        String result = generateTypescriptInterpretation("length(items[-1]) == `0`");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  return (result.items[result.items.length - 1].length == 0.0);\n}\n"));
    }

    @Test
    public void createContainsProfile() {
        String result = generateTypescriptInterpretation("contains(items[].State, `false`)");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let flat_1: any[] = [].concat(...result.items);\n  let projection_3 = flat_1.map((element_2: any) => {\n    return element_2.State;\n  });\n  return projection_3.includes(false);\n}\n"));
    }

    @Test
    public void createWildcardIndex() {
        String result = generateTypescriptInterpretation("foo.*.bar");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let objectProjection_2 = Object.values(result.foo).map((element_1: any) => {\n    return element_1.bar;\n  });\n  return objectProjection_2;\n}\n"));
    }

    @Test
    public void createFilterIndex() {
        String result = generateTypescriptInterpretation("items[?foo=='awesome'][]");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let filterRes_2 = result.items.filter((element_1: any) => {\n    return (element_1.foo == \"awesome\");\n  });\n  let flat_3: any[] = [].concat(...filterRes_2);\n  return flat_3;\n}\n"));
    }

    @Test
    public void createMultiIndex() {
        String result = generateTypescriptInterpretation("items[].[`4` > `0`, `1` == `0`][]");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let flat_1: any[] = [].concat(...result.items);\n  let projection_3 = flat_1.map((element_2: any) => {\n    let result_4 = [];\n    result_4.push((4.0 > 0.0));\n    result_4.push((1.0 == 0.0));\n    element_2 = result_4;\n    return element_2;\n  });\n  let flat_5: any[] = [].concat(...projection_3);\n  return flat_5;\n}\n"));
    }

    @Test
    public void createLengthFilterInstancesIndex() {
        String result = generateTypescriptInterpretation("length(Instances[?LifecycleState==\"InService\"]) >= MinSize");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let filterRes_2 = result.Instances.filter((element_1: any) => {\n    return (element_1.LifecycleState == element_1.InService);\n  });\n  return (filterRes_2.length >= result.MinSize);\n}\n"));
    }

    @Test
    public void createComplexLengthFilterContainsIndex() {
        String result = generateTypescriptInterpretation("contains(AutoScalingGroups[].[length(Instances[?LifecycleState=='InService']) >= MinSize][], `false`)");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let flat_1: any[] = [].concat(...result.AutoScalingGroups);\n  let projection_3 = flat_1.map((element_2: any) => {\n    let filterRes_5 = element_2.Instances.filter((element_4: any) => {\n      return (element_4.LifecycleState == \"InService\");\n    });\n    let result_6 = [];\n    result_6.push((filterRes_5.length >= element_2.MinSize));\n    element_2 = result_6;\n    return element_2;\n  });\n  let flat_7: any[] = [].concat(...projection_3);\n  return flat_7.includes(false);\n}\n"));
    }

    @Test
    public void createNotIndex() {
        String result = generateTypescriptInterpretation("!(length(items) == `0`)");
        assertThat(result,
                equalTo( "let returnComparator = () => {\n  return (!(result.items.length == 0.0));\n}\n"));
    }

    @Test
    public void createOrIndex() {
        String result = generateTypescriptInterpretation("length(items[]) == `0` || length(foo) > `0`");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let flat_1: any[] = [].concat(...result.items);\n  return (((flat_1.length == 0.0) || (result.foo.length > 0.0)) && ((result.foo.length > 0.0) || (flat_1.length == 0.0))) ;\n}\n"));
    }

    @Test
    public void createAndIndex() {
        String result = generateTypescriptInterpretation("length(items[]) == `0` && length(foo) > `0`");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let flat_1: any[] = [].concat(...result.items);\n  return ((flat_1.length == 0.0) && (result.foo.length > 0.0));\n}\n"));
    }

    @Test
    public void createComplexAndNotIndex() {
        String result = generateTypescriptInterpretation("(length(services[?!(length(deployments) == `1` && runningCount == desiredCount)]) == `0`)");
        assertThat(result,
                equalTo("let returnComparator = () => {\n  let filterRes_2 = result.services.filter((element_1: any) => {\n    return (!((element_1.deployments.length == 1.0) && (element_1.runningCount == element_1.desiredCount)));\n  });\n  return (filterRes_2.length == 0.0);\n}\n"));
    }
}
