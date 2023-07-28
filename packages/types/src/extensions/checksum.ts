import {ChecksumConstructor} from "../checksum";
import {HashConstructor} from "../crypto";
import {DefaultClientConfiguration} from "./defaultClientConfiguration";

/**
 * @internal
 */
export interface ChecksumAlgorithm {
    algorithmId(): string;
    checksumConstructor(): ChecksumConstructor | HashConstructor;
}

/**
 * @internal
 */
export const getChecksumClientConfiguration = (runtimeConfig: any) => {
    const checksumAlgorithms: ChecksumAlgorithm[] = [];

    if (runtimeConfig.sha256 !== undefined) {
        checksumAlgorithms.push({
            algorithmId: () => "sha256",
            checksumConstructor: runtimeConfig.sha256
        })
    }

    if (runtimeConfig.md5 !== undefined) {
        checksumAlgorithms.push({
            algorithmId: () => "md5",
            checksumConstructor: runtimeConfig.md5
        })
    }

    const clientConfiguration = {
        _checksumAlgorithms: checksumAlgorithms,
        addChecksumAlgorithm: function(algo: ChecksumAlgorithm): void {
            this._checksumAlgorithms.push(algo);
        },
        checksumAlgorithms: function(): ChecksumAlgorithm[] {
            return this._checksumAlgorithms;
        }
    }

    return clientConfiguration;
}

/**
 * @internal
 */
export const resolveChecksumRuntimeConfig = (clientConfig: DefaultClientConfiguration) => {
    const runtimeConfig: any = {
    };

    clientConfig.checksumAlgorithms().forEach(checksumAlgorithm => {
        runtimeConfig[checksumAlgorithm.algorithmId()] = checksumAlgorithm.checksumConstructor();
    });

    return runtimeConfig;
}