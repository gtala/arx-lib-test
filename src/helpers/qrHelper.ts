import { bcs } from "@mysten/sui.js/bcs";
import { sha256 } from "@noble/hashes/sha256";
export const getSignatureAsUint8Array = async (
  r: string,
  s: string,
  v: number
) => {
  // Convert r, s values to Uint8Array
  const rBytes = Uint8Array.from(Buffer.from(r, "hex"));
  const sBytes = Uint8Array.from(Buffer.from(s, "hex"));
  const vByte = Uint8Array.from([v]);
  // @ts-ignore
  const signature = new Uint8Array([...rBytes, ...sBytes, ...vByte]);

  return signature;
};
// Function to convert hexadecimal string to array of unsigned 8-bit integers
export const hexToUint8Array = (publicKey: string) => {
  const publicKeyBuffer = Buffer.from(publicKey, "hex");
  console.log("publicKeyBuffer!!!!!!!!!!!!!!!", publicKeyBuffer);
  //convert the buffer back to hex
  const hex = publicKeyBuffer.toString("hex");
  console.log("hex!!!!!!!!!!!!!!!", hex);
  return new Uint8Array(publicKeyBuffer);
};
///
function numberToBCS(num: number): Uint8Array {
  const bigIntValue = BigInt(num);
  const buf = Buffer.alloc(8);

  buf.writeBigUInt64LE(bigIntValue);

  return new Uint8Array(buf);
}

export const generateMessage = (address: string) => {
  // Remove the "0x" prefix and convert to Uint8Array
  let addressBytes: Uint8Array = new Uint8Array(
    Buffer.from(address.slice(2), "hex")
  );

  const now_timestamp = Date.now();
  let timestampBytes: Uint8Array = new Uint8Array(numberToBCS(now_timestamp));

  const msgToSignBytes: Uint8Array = new Uint8Array([
    // @ts-ignore
    ...addressBytes,
    // @ts-ignore
    ...timestampBytes,
  ]);

  // console.log("---------msgToSign ---------", msgToSignBytes);

  return [msgToSignBytes, now_timestamp];
};


export const createMsgDigest = async (address: string, timestamp: number) => {
  console.log("address", address);
  console.log("timestamp", timestamp);

  const addr_bytes = bcs.ser("address", address).toBytes();
  const ts_bytes = bcs.ser("u64", timestamp).toBytes();
  const msgToDigest = new Uint8Array(addr_bytes.length + ts_bytes.length);
  msgToDigest.set(addr_bytes);
 // msgToDigest.set(ts_bytes, addr_bytes.length);
  const msgDigestHex = uint8array2hex(sha256(msgToDigest));

  return [msgDigestHex, timestamp];
};

function uint8array2hex(uint8array: Uint8Array): string {
  return Buffer.from(uint8array).toString("hex");
}

export interface Command {
  name: string;
  digest: string;
  keyNo: number;
}