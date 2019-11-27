package software.amazon.smithy.typescript.codegen.integration;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;

public class HttpProtocolGeneratorUtilsTest {
    private static final String DATA_SOURCE = "dataSource";

    @Test
    public void givesCorrectTimestampSerialization() {
        TimestampShape shape = TimestampShape.builder().id("com.smithy.example#Foo").build();

        assertThat(DATA_SOURCE + ".toISOString()",
                equalTo(HttpProtocolGeneratorUtils.getTimestampInputParam(DATA_SOURCE, shape, Format.DATE_TIME)));
        assertThat("Math.round(" + DATA_SOURCE + ".getTime() / 1000)",
                equalTo(HttpProtocolGeneratorUtils.getTimestampInputParam(DATA_SOURCE, shape, Format.EPOCH_SECONDS)));
        assertThat(DATA_SOURCE + ".toUTCString()",
                equalTo(HttpProtocolGeneratorUtils.getTimestampInputParam(DATA_SOURCE, shape, Format.HTTP_DATE)));
    }

    @Test
    public void givesCorrectTimestampDeserialization() {
        TimestampShape shape = TimestampShape.builder().id("com.smithy.example#Foo").build();

        assertThat("new Date(" + DATA_SOURCE + ")",
                equalTo(HttpProtocolGeneratorUtils.getTimestampOutputParam(DATA_SOURCE, shape, Format.DATE_TIME)));
        assertThat("new Date(" + DATA_SOURCE + " % 1 != 0 ? Math.round("
                           + DATA_SOURCE + " * 1000) : " + DATA_SOURCE + ")",
                equalTo(HttpProtocolGeneratorUtils.getTimestampOutputParam(DATA_SOURCE, shape, Format.EPOCH_SECONDS)));
        assertThat("new Date(" + DATA_SOURCE + ")",
                equalTo(HttpProtocolGeneratorUtils.getTimestampOutputParam(DATA_SOURCE, shape, Format.HTTP_DATE)));
    }
}
