import { isArnBucketName } from "./s3";

describe("S3 customizations for endpoint resolution", () => {
  describe(isArnBucketName.name, () => {
    it("should require the partition, service, and a resource id", () => {
      expect(isArnBucketName("arn:aws:s3:us-east-1:1234567890:bucket_name")).toBe(true);

      expect(() => isArnBucketName("arn::s3:us-east-1:1234567890:bucket_name")).toThrow();
      expect(() => isArnBucketName("arn:aws::us-east-1:1234567890:bucket_name")).toThrow();
      expect(() => isArnBucketName("arn:aws:s3:us-east-1:1234567890:")).toThrow();
    });
    it("should not require the account id", () => {
      expect(isArnBucketName("arn:aws:s3:::bucket_name")).toBe(true);
      expect(isArnBucketName("arn:aws:s3::123456789:bucket_name")).toBe(true);

      expect(() => isArnBucketName("arn:aws:s3:::")).toThrow();
      expect(() => isArnBucketName("arn:aws:s3::123456789:")).toThrow();
    });
  });
});
