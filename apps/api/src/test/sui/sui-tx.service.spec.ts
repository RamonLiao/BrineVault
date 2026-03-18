import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuiTxService } from '../../infra/sui/sui-tx.service.js';

// Mock Transaction so tx.build() never hits the network
vi.mock('@mysten/sui/transactions', () => {
  const mockTx = {
    setSender: vi.fn(),
    moveCall: vi.fn(),
    object: vi.fn((id: string) => ({ Object: id })),
    pure: {
      u8: vi.fn((v: number) => ({ Pure: ['u8', v] })),
      u64: vi.fn((v: bigint) => ({ Pure: ['u64', v] })),
      bool: vi.fn((v: boolean) => ({ Pure: ['bool', v] })),
      id: vi.fn((v: string) => ({ Pure: ['id', v] })),
      address: vi.fn((v: string) => ({ Pure: ['address', v] })),
      string: vi.fn((v: string) => ({ Pure: ['string', v] })),
      vector: vi.fn((type: string, v: unknown) => ({ Pure: ['vector', type, v] })),
      option: vi.fn((type: string, v: unknown) => ({ Pure: ['option', type, v] })),
    },
    build: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
  };

  return {
    Transaction: vi.fn(() => mockTx),
  };
});

describe('SuiTxService', () => {
  let service: SuiTxService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SuiTxService({
      rpcUrl: 'https://fullnode.testnet.sui.io',
      packageId: '0x' + 'a'.repeat(64),
      platformKeypair: null,
    });
  });

  describe('submitSignedTx', () => {
    it('should call executeTransactionBlock with correct params', async () => {
      const mockResult = {
        digest: '0xabc',
        effects: { status: { status: 'success' } },
      };
      const mockClient = {
        executeTransactionBlock: vi.fn().mockResolvedValue(mockResult),
      };
      (service as any).client = mockClient;

      const result = await service.submitSignedTx({
        txBytes: 'base64txbytes',
        signature: 'base64sig',
      });

      expect(mockClient.executeTransactionBlock).toHaveBeenCalledWith({
        transactionBlock: 'base64txbytes',
        signature: 'base64sig',
        options: { showEffects: true, showEvents: true },
      });
      expect(result.digest).toBe('0xabc');
    });
  });

  describe('hexToBytes', () => {
    it('should convert hex string to byte array', () => {
      const result = (service as any).hexToBytes('deadbeef');
      expect(result).toEqual([0xde, 0xad, 0xbe, 0xef]);
    });

    it('should handle empty string', () => {
      const result = (service as any).hexToBytes('');
      expect(result).toEqual([]);
    });
  });

  describe('buildSubmitReviewTx', () => {
    it('returns base64 txBytes', async () => {
      const result = await service.buildSubmitReviewTx({
        senderAddress: '0x' + 'a'.repeat(64),
        adminConfigId: 'admin-cfg-1',
        poolObjectId: '0x' + 'b'.repeat(64),
        docObjectId: '0x' + 'c'.repeat(64),
        status: 1,
        commentHash: 'd'.repeat(64),
      });
      expect(result.txBytes).toBeDefined();
      expect(typeof result.txBytes).toBe('string');
    });

    it('handles optional commentHash (no comment)', async () => {
      const result = await service.buildSubmitReviewTx({
        senderAddress: '0x' + 'a'.repeat(64),
        adminConfigId: 'admin-cfg-1',
        poolObjectId: '0x' + 'b'.repeat(64),
        docObjectId: '0x' + 'c'.repeat(64),
        status: 0,
      });
      expect(result.txBytes).toBeDefined();
    });

    // Monkey tests
    it('handles status boundary value 255 (u8 max)', async () => {
      const result = await service.buildSubmitReviewTx({
        senderAddress: '0x' + 'a'.repeat(64),
        adminConfigId: 'admin-cfg-1',
        poolObjectId: '0x' + 'b'.repeat(64),
        docObjectId: '0x' + 'c'.repeat(64),
        status: 255,
      });
      expect(result.txBytes).toBeDefined();
    });

    it('handles empty commentHash string as falsy (uses option null)', async () => {
      const result = await service.buildSubmitReviewTx({
        senderAddress: '0x' + 'a'.repeat(64),
        adminConfigId: 'admin-cfg-1',
        poolObjectId: '0x' + 'b'.repeat(64),
        docObjectId: '0x' + 'c'.repeat(64),
        status: 1,
        commentHash: '',
      });
      expect(result.txBytes).toBeDefined();
    });
  });

  describe('IC Decision TX builders', () => {
    const icParams = {
      senderAddress: '0x' + 'a'.repeat(64),
      adminConfigId: 'admin-cfg-1',
      poolObjectId: '0x' + 'b'.repeat(64),
      decisionText: 'Approved by IC',
      pdfBlobId: 'walrus-blob-123',
      committeeMembers: ['0x' + 'c'.repeat(64), '0x' + 'd'.repeat(64)],
      votes: [1, 1],
      relatedDocIds: ['0x' + 'e'.repeat(64)],
    };

    it('buildRecordIcApprovalTx returns txBytes', async () => {
      const result = await service.buildRecordIcApprovalTx(icParams);
      expect(result.txBytes).toBeDefined();
    });

    it('buildRecordIcRejectionTx returns txBytes', async () => {
      const result = await service.buildRecordIcRejectionTx(icParams);
      expect(result.txBytes).toBeDefined();
    });

    it('buildRecordIcRequestChangesTx returns txBytes', async () => {
      const result = await service.buildRecordIcRequestChangesTx(icParams);
      expect(result.txBytes).toBeDefined();
    });

    // Monkey tests
    it('handles empty committeeMembers and votes arrays', async () => {
      const result = await service.buildRecordIcApprovalTx({
        ...icParams,
        committeeMembers: [],
        votes: [],
      });
      expect(result.txBytes).toBeDefined();
    });

    it('handles empty relatedDocIds array', async () => {
      const result = await service.buildRecordIcRejectionTx({
        ...icParams,
        relatedDocIds: [],
      });
      expect(result.txBytes).toBeDefined();
    });

    it('handles unicode in decisionText', async () => {
      const result = await service.buildRecordIcRequestChangesTx({
        ...icParams,
        decisionText: '決策：需要更多文件 🔍',
      });
      expect(result.txBytes).toBeDefined();
    });

    it('all three methods return valid base64 strings', async () => {
      const [approval, rejection, requestChanges] = await Promise.all([
        service.buildRecordIcApprovalTx(icParams),
        service.buildRecordIcRejectionTx(icParams),
        service.buildRecordIcRequestChangesTx(icParams),
      ]);
      for (const r of [approval, rejection, requestChanges]) {
        expect(typeof r.txBytes).toBe('string');
        // valid base64: decodes without throwing
        expect(() => Buffer.from(r.txBytes, 'base64')).not.toThrow();
      }
    });
  });
});
