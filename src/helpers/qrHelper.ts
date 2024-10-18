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
