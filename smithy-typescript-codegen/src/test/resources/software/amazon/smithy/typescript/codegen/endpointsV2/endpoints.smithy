$version: "2.0"

namespace smithy.example

@smithy.rules#endpointRuleSet({
  "version": "1.3"
  "parameters": {
    "Region": {
      "builtIn": "AWS::Region",
      "type": "String",
      "required": true,
      "default": "us-east-1",
      "documentation": "The region to dispatch this request, eg. `us-east-1`."
    },
    "Stage": {
      "type": "String",
      "required": true,
      "default": "production"
    },
    "Endpoint": {
      "builtIn": "SDK::Endpoint",
      "type": "String",
      "required": false,
      "documentation": "Override the endpoint used to send this request"
    }
  },
  "rules": [
    {
      "conditions": [
        {
          "fn": "isSet",
          "argv": [
            {
              "ref": "Endpoint"
            }
          ]
        },
        {
          "fn": "parseURL",
          "argv": [
            {
              "ref": "Endpoint"
            }
          ],
          "assign": "url"
        }
      ],
      "endpoint": {
        "url": {
          "ref": "Endpoint"
        },
        "properties": {},
        "headers": {}
      },
      "type": "endpoint"
    },
    {
      "documentation": "Template the region into the URI when region is set",
      "conditions": [
      ],
      "type": "tree",
      "rules": [
        {
          "conditions": [
            {
              "fn": "stringEquals",
              "argv": [
                {
                  "ref": "Stage"
                },
                "staging"
              ]
            }
          ],
          "endpoint": {
            "url": "https://{Region}.staging.example.com/2023-01-01",
            "properties": {},
            "headers": {}
          },
          "type": "endpoint"
        },
        {
          "conditions": [],
          "endpoint": {
            "url": "https://{Region}.example.com/2023-01-01",
            "properties": {},
            "headers": {}
          },
          "type": "endpoint"
        }
      ]
    },
    {
      "documentation": "Fallback when region is unset",
      "conditions": [],
      "error": "Region must be set to resolve a valid endpoint",
      "type": "error"
    }
  ]
})
@smithy.rules#clientContextParams(
  Stage: {type: "string", documentation: "The endpoint stage used to construct the hostname."}
)
service Example {
    version: "2023-01-01"
    operations: [GetFoo]
}

@readonly
operation GetFoo {
    input: GetFooInput
    output: GetFooOutput
}

structure GetFooInput {
    @required
    @hostLabel
    foo: String
}
structure GetFooOutput {}
