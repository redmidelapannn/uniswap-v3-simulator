import { ethers } from "hardhat";
import { DateConverter } from "../src/util/DateConverter";
import type { Hypervisor } from "../typechain";
import { TickMath } from "../src/util/TickMath";
import { BigNumber } from "ethers";

let poolAddress = "0x716bd8A7f8A44B010969A1825ae5658e7a18630D";
let fromBlock = 12619747;
let toBlock = 13595744;
const DATE_FORMAT: string = "YYYY-MM-DD HH:mm:ss";

async function main() {
  let hypervisor = (await ethers.getContractAt(
    "Hypervisor",
    poolAddress
  )) as Hypervisor;
  let topic = hypervisor.filters.Rebalance();
  let events = await hypervisor.queryFilter(topic, fromBlock, toBlock);
  // table head
  console.log(
    `blockNum,timestamp,date,totalAmount0,totalAmount1,feeAmount0,feeAmount1,unitPrice,currPrice,baseLower,baseUpper,limitLower,limitUpper`
  );
  for (let event of events) {
    let block = await ethers.provider.getBlock(event.blockNumber);
    let date = new Date(block.timestamp * 1000);

    let blockNum = block.number;
    let tick = await hypervisor.currentTick({
      blockTag: blockNum,
    });
    let sqrtPrice = tickToSqrtPrice(tick);
    let basePosition = await hypervisor.getBasePosition();
    let baseLower = await hypervisor.baseLower({
      blockTag: blockNum,
    });
    let baseUpper = await hypervisor.baseUpper({
      blockTag: blockNum,
    });
    let limitLower = await hypervisor.limitLower({
      blockTag: blockNum,
    });
    let limitUpper = await hypervisor.limitUpper({
      blockTag: blockNum,
    });
    console.log(
      `${block.number},${block.timestamp},${DateConverter.formatDate(
        date,
        DATE_FORMAT
      )},${event.args.totalAmount0},${event.args.totalAmount1},${
        event.args.feeAmount0
      },${event.args.feeAmount1},${await computeUnitPrice(
        block.number,
        sqrtPrice
      )},${sqrtPriceToView(sqrtPrice)},${sqrtPriceToView(
        tickToSqrtPrice(baseUpper)
      )},${sqrtPriceToView(tickToSqrtPrice(baseLower))},${sqrtPriceToView(
        tickToSqrtPrice(limitUpper)
      )},${sqrtPriceToView(tickToSqrtPrice(limitLower))}`
    );
  }

  function tickToSqrtPrice(tick: number): BigNumber {
    return BigNumber.from(TickMath.getSqrtRatioAtTick(tick).toString());
  }

  function sqrtPriceToView(sqrtPriceX96: BigNumber): BigNumber {
    return BigNumber.from(10)
      .pow(12)
      .div(
        BigNumber.from(sqrtPriceX96)
          .pow(2)
          .shr(96 * 2)
      );
  }

  async function computeUnitPrice(
    blockNum: number,
    sqrtPriceX96: BigNumber
  ): Promise<BigNumber> {
    let precision = BigNumber.from(1e8);

    let tokenamounts = await hypervisor.getTotalAmounts({
      blockTag: blockNum,
    });

    let totalSupply = await hypervisor.totalSupply({
      blockTag: blockNum,
    });

    return tokenamounts[0]
      .mul(sqrtPriceX96.pow(2))
      .div(BigNumber.from(2).pow(192))
      .add(tokenamounts[1])
      .mul(precision)
      .div(totalSupply);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
