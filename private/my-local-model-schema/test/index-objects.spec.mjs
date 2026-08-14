import {
  Alpha$,
  camelCaseOperation$,
  CamelCaseOperationCommand,
  camelCaseOperationInput$,
  camelCaseOperationOutput$,
  CodedThrottlingError,
  CodedThrottlingError$,
  ConstrainedAddress$,
  DifferentShapeName$,
  Gamma$,
  GammaPayload$,
  GetNumbers$,
  GetNumbersCommand,
  GetNumbersRequest$,
  GetNumbersResponse$,
  HaltError,
  HaltError$,
  HeartbeatEvent$,
  HostPrefixOperation$,
  HostPrefixOperationCommand,
  HostPrefixOperationInput$,
  HttpLabelCommand$,
  HttpLabelCommandCommand,
  HttpLabelCommandInput$,
  HttpLabelCommandOutput$,
  LogEvent$,
  MainServiceLinkedError,
  MainServiceLinkedError$,
  MetricEvent$,
  MysteryThrottlingError,
  MysteryThrottlingError$,
  NotificationEvent$,
  paginatecamelCaseOperation,
  paginateGetNumbers,
  PublishEvents$,
  PublishEventsCommand,
  PublishEventsRequest$,
  PublishEventsResponse$,
  PublishEventStream$,
  RetryableError,
  RetryableError$,
  SubscribeEventStream$,
  SubscribeToEvents$,
  SubscribeToEventsCommand,
  SubscribeToEventsRequest$,
  SubscribeToEventsResponse$,
  TradeEvents$,
  TradeEventStream$,
  TradeEventStreamCommand,
  TradeEventStreamRequest$,
  TradeEventStreamResponse$,
  ValidatedInput$,
  ValidatedOperation$,
  ValidatedOperationCommand,
  ValidatedOutput$,
  waitForNumbersAligned,
  waitForNumbersMisaligned,
  waitForNumbersWhatDoTheyDoAnyway,
  waitUntilNumbersAligned,
  waitUntilNumbersMisaligned,
  waitUntilNumbersWhatDoTheyDoAnyway,
  XYZService,
  XYZServiceClient,
  XYZServiceServiceException,
  XYZServiceServiceException$,
  XYZServiceSyntheticServiceException,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof XYZServiceClient === "function");
assert(typeof XYZService === "function");
// commands
assert(typeof HttpLabelCommandCommand === "function");
assert(typeof HttpLabelCommand$ === "object");
assert(typeof CamelCaseOperationCommand === "function");
assert(typeof camelCaseOperation$ === "object");
assert(typeof GetNumbersCommand === "function");
assert(typeof GetNumbers$ === "object");
assert(typeof HostPrefixOperationCommand === "function");
assert(typeof HostPrefixOperation$ === "object");
assert(typeof PublishEventsCommand === "function");
assert(typeof PublishEvents$ === "object");
assert(typeof SubscribeToEventsCommand === "function");
assert(typeof SubscribeToEvents$ === "object");
assert(typeof TradeEventStreamCommand === "function");
assert(typeof TradeEventStream$ === "object");
assert(typeof ValidatedOperationCommand === "function");
assert(typeof ValidatedOperation$ === "object");
// structural schemas
assert(typeof HttpLabelCommandInput$ === "object");
assert(typeof HttpLabelCommandOutput$ === "object");
assert(typeof Alpha$ === "object");
assert(typeof camelCaseOperationInput$ === "object");
assert(typeof camelCaseOperationOutput$ === "object");
assert(typeof ConstrainedAddress$ === "object");
assert(typeof DifferentShapeName$ === "object");
assert(typeof Gamma$ === "object");
assert(typeof GammaPayload$ === "object");
assert(typeof GetNumbersRequest$ === "object");
assert(typeof GetNumbersResponse$ === "object");
assert(typeof HeartbeatEvent$ === "object");
assert(typeof HostPrefixOperationInput$ === "object");
assert(typeof LogEvent$ === "object");
assert(typeof MetricEvent$ === "object");
assert(typeof NotificationEvent$ === "object");
assert(typeof PublishEventsRequest$ === "object");
assert(typeof PublishEventsResponse$ === "object");
assert(typeof PublishEventStream$ === "object");
assert(typeof SubscribeEventStream$ === "object");
assert(typeof SubscribeToEventsRequest$ === "object");
assert(typeof SubscribeToEventsResponse$ === "object");
assert(typeof TradeEvents$ === "object");
assert(typeof TradeEventStreamRequest$ === "object");
assert(typeof TradeEventStreamResponse$ === "object");
assert(typeof ValidatedInput$ === "object");
assert(typeof ValidatedOutput$ === "object");
// errors
assert(CodedThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof CodedThrottlingError$ === "object");
assert(HaltError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof HaltError$ === "object");
assert(MainServiceLinkedError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof MainServiceLinkedError$ === "object");
assert(MysteryThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof MysteryThrottlingError$ === "object");
assert(RetryableError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof RetryableError$ === "object");
assert(XYZServiceServiceException.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof XYZServiceServiceException$ === "object");
assert(XYZServiceSyntheticServiceException.prototype instanceof Error);
// waiters
assert(typeof waitForNumbersAligned === "function");
assert(typeof waitForNumbersMisaligned === "function");
assert(typeof waitForNumbersWhatDoTheyDoAnyway === "function");
assert(typeof waitUntilNumbersAligned === "function");
assert(typeof waitUntilNumbersMisaligned === "function");
assert(typeof waitUntilNumbersWhatDoTheyDoAnyway === "function");
// paginators
assert(typeof paginateGetNumbers === "function");
assert(typeof paginatecamelCaseOperation === "function");
console.log(`XYZService index test passed.`);
