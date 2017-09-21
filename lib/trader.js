const toFixed = require('./utilities').fixedDecimals;
const btfnxPrice = require('./utilities').btfnxPrice;
const Average = require('./average');

/**
 * Trader responsible for financial calculations:
 * - calculating support & resistance lines
 * - figuring out when to buy or sell
 */
module.exports = function (fees, placeOrder)
{
    const symbol = 'btcusd';
    const exchange = 'bitfinex';
    const sellType = 'fill-or-kill';

    const risk = parseFloat(process.env.RISK);
    const maxLoss = parseFloat(process.env.MAX_LOSS);
    const minGain = parseFloat(process.env.MIN_GAIN);
    const maxWait = parseInt(process.env.MAX_WAIT);
    const resolution = parseInt(process.env.RESOLUTION);
    const minTrades = parseInt(process.env.MIN_TRADES);
    const sellOffset = parseFloat(process.env.SELL_OFFSET);

    const self = this;

    self.average = new Average(resolution, minTrades);

    self.resetActiveData = resetActiveData;
    self.gotTrade = gotTrade;

    self.activeData = {
        sellPrice: null,
        sellTime: null
    };
    self.currentAverage = null;
    self.stopLossPrice = null;
    self.minSellPrice = null;
    return self;

    /* Public methods */
    function gotTrade(trade, data)
    {
        const tic = self.average.updatedAverage(trade);
        const sellprice = btfnxPrice(tic - (tic * sellOffset));

        self.currentAverage = tic;

        // If there is already an active order, exit
        if (data.activeBuy || data.activeSell) return;

        // If you have an activ eposition check if a sell would be appropriate
        if (data.positions && data.positions.length > 0)
        {
            var position = data.positions[0];

            // If there is no pre-existing min sell price, set it
            if (!self.minSellPrice)
            {
                self.minSellPrice = getLowestSellPrice(position.price);
            }

            // If there is no pre-existing stop loss zone, set it
            if (!self.stopLossPrice)
            {
                self.stopLossPrice = getStopLossPrice(position.price);
            }

            // Stop loss sell if the price has dropped far enough
            if (tic < self.stopLossPrice)
            {
                return placeOrder(sellOrder(sellprice, position.amount));
            }

            // If the ticker is below the minimum sell amount to break even, exit
            if (comparePrices(tic, self.minSellPrice) < 1) return;

            // If this is the first sign of a sell, just record this moment
            if (!self.activeData.sellPrice || !self.activeData.sellTime)
            {
                return setPossibleSell(tic);
            }

            // If the ticker has risen since last time, just record this moment
            if (comparePrices(tic, self.activeData.sellPrice) === 1)
            {
                return setPossibleSell(tic);
            }

            // If the ticker has dropped below the highest price recorded, sell
            if (tic < getMaxDrop(self.activeData.sellPrice))
            {
                return placeOrder(sellOrder(sellprice, position.amount));
            }

            // If it's been long enough, sell
            if (self.activeData.sellTime + maxWait < Date.now())
            {
                return placeOrder(sellOrder(sellprice, position.amount));
            }
        }
    }

    function sellOrder(price, amount)
    {
        // Make sure to round down & trim to correct number of decimals
        const sellPrice = btfnxPrice(price);

        // Bitfinex goes up to 8 decimals maximum for trades
        const sellAmount = toFixed(amount, 8);

        // Return that data to the app
        return {
            symbol: symbol,
            amount: String(sellAmount),
            price: String(sellPrice),
            exchange: exchange,
            side: 'sell',
            type: sellType
        };
    }

    /* Private methods */
    function setPossibleSell(price)
    {
        self.activeData.sellPrice = price;
        self.activeData.sellTime = Date.now();
    }

    // The amount below the current price to sell and limit our losses
    function getStopLossPrice(price)
    {
        return parseFloat(price) * (1 - (fees.maker + maxLoss));
    }

    // The amount above the current price required for a sell
    function getLowestSellPrice(price)
    {
        return parseFloat(price) * (1 + fees.maker + minGain);
    }

    // The price below the current sell position that would indicate
    // that the ticker will keep dropping
    function getMaxDrop(price)
    {
        const possiblePrice = parseFloat(price) * (1 - risk);

        // Just make sure the new price is actually lower even when rounded to the right
        // number of decimals
        if (btfnxPrice(possiblePrice) < btfnxPrice(price)) return possiblePrice;

        // If it is not, then just subtract the smallest possible unit to the price
        return price - 0.1;
    }

    // Utility to reset the active data when a trade is executed
    function resetActiveData()
    {
        self.activeData = {};
        self.stopLossPrice = null;
    }

    function comparePrices(p1, p2)
    {
        p1 = btfnxPrice(p1);
        p2 = btfnxPrice(p2);
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
        return 0;
    }
};