package software.amazon.smithy.typescript.codegen.validation;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import java.util.List;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.validation.ValidationEvent;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;

public class LongValidatorTest {
  @Test
  public void findsDoubles() {
    Model model =
        Model.assembler()
            .addImport(getClass().getResource("long-validation.smithy"))
            .assemble()
            .unwrap();
    TypeScriptSettings settings = new TypeScriptSettings();
    settings.setService(ShapeId.from("smithy.example#Example"));
    LongValidator validator = new LongValidator(settings);
    List<ValidationEvent> result = validator.validate(model);
    assertThat(result.size(), equalTo(1));
  }
}
