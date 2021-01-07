/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.loader.ModelAssembler;
import software.amazon.smithy.model.shapes.SmithyIdlModelSerializer;


public class SmithyModelGenerator {

    File[] JsonModels;
    String outputLocation;

    SmithyModelGenerator(String inputLocation, String ouputLocation){
        File folder = new File(inputLocation);
        JsonModels = folder.listFiles((dir, name) -> name.endsWith(".json"));
        this.outputLocation = ouputLocation;
    }

    void run() throws IOException {

        for (File jsonModel: JsonModels) {
            System.out.println("Converting: " + jsonModel.toString());

            String output = jsonModel.getName().split('\.')[0];


            Path path = Paths.get(jsonModel.getAbsolutePath());
            String content = Files.readString(path, StandardCharsets.UTF_8);

            ModelAssembler modelAssembler = Model.assembler().addUnparsedModel(jsonModel.getAbsolutePath(), content);
            modelAssembler = modelAssembler.discoverModels();
            Model model = modelAssembler.assemble().getResult().orElseThrow();
            SmithyIdlModelSerializer serializer = new SmithyIdlModelSerializer.Builder().build();

            Map<Path, String> result = serializer.serialize(model);

            System.out.println(result);

        }
    }

    public static void main(String[] args) {

        String INPUT_LOCATION = "modelJson";
        String OUTPUT_LOCATION = "modelSmithy";
        SmithyModelGenerator smithyModelGenerator = new SmithyModelGenerator(INPUT_LOCATION, OUTPUT_LOCATION);
        try {
            smithyModelGenerator.run();
        } catch (IOException e) {

        }

    }
}