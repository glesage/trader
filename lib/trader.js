var toFixed = require('./utilities').fixedDecimals;
var btfnxPrice = require('./utilities').btfnxPrice;
var Average = require('./average');

/**
 * Trader responsible for financial calculations:
 * - calculating support & resistance lines
 * - figuring out when to buy or sell
 */
module.exports = function (fees, placeOrder)
{
    var symbol = 'btcusd';
    var exchange = 'bitfinex';
    var type = 'exchange limit';

    var risk = parseFloat(process.env.RISK);
    var maxLoss = parseFloat(process.env.MAX_LOSS);
    var minGain = parseFloat(process.env.MIN_GAIN);
    var maxWait = parseInt(process.env.MAX_WAIT);
    var resolution = parseInt(process.env.RESOLUTION);
    var minTradeBTC = 0.01;

    var average = new Average(resolution);

    var self = this;
    self.gotTrade = gotTrade;
    self.activeData = {
        buyPrice: null,
        buyTime: null,
        sellPrice: null,
        sellTime: null,
        stopLossZone: null
    };
    self.currentAverage = null;
    self.highestSupportZone = null;
    self.lowestResistanceZone = null;
    return self;

    /* Public methods */
    function gotTrade(trade, data)
    {
        var tic = average.updatedAverage(trade);

        self.currentAverage = tic;


        // If there is already an active order, exit
        if (data.activeBuy || data.activeSell) return;


        // If USD balance is above Bitfinex min order check if a buy would be appropriate
        if (data.balanceUSD > 0 && data.balanceUSD > (minTradeBTC * tic))
        {
            // Don't try to buy if buys are disabled
            if (!process.env.ALLOW_BUY) return;

            var newSupportZone = getSupportZone(tic);

            // If there is no pre-existing support zone, set it and exit
            if (!self.highestSupportZone)
            {
                self.highestSupportZone = newSupportZone;
                return;
            }

            // If the new support zone is higher than the previous one, set it
            if (comparePrices(newSupportZone, self.highestSupportZone) === 1)
            {
                self.highestSupportZone = newSupportZone;
                return;
            }

            // If the ticker is above the support zone, exit
            if (comparePrices(tic, self.highestSupportZone) > -1) return;

            // If this is the first sign of a buy, just record this moment
            if (!self.activeData.buyPrice || !self.activeData.buyTime) return setPossibleBuy(tic);

            // If the ticker has dropped since last time, just record this moment
            if (comparePrices(tic, self.activeData.buyPrice) === -1) return setPossibleBuy(tic);

            // If the ticker has increased above the lowest price recorded, buy
            if (tic < getMaxIncrease(self.activeData.buyPrice))
            {
                return placeOrder(buyOrder(btfnxPrice(tic), data.balanceUSD));
            }

            // If it's been long enough, buy
            if (self.activeData.buyTime + maxWait > Date.now())
            {
                return placeOrder(buyOrder(btfnxPrice(tic), data.balanceUSD));
            }
        }

        // If BTC balance is above Bitfinex minimum check if a sell would be appropriate
        else if (data.balanceBTC > 0 && data.balanceBTC > minTradeBTC)
        {
            // Don't try to sell if sells are disabled
            if (!process.env.ALLOW_SELL) return;

            // If there is no pre-existing resistance zone, set it
            if (!self.lowestResistanceZone)
            {
                self.lowestResistanceZone = getLowestSellPrice(data.lastBuy.price);
            }

            // If there is no pre-existing stop loss zone, set it
            if (!self.activeData.stopLossZone)
            {
                self.activeData.stopLossZone = getStopLossZone(data.lastBuy.price);
            }

            // Stop loss sell if the price has dropped far enough
            if (tic < self.activeData.stopLossZone)
            {
                return placeOrder(sellOrder(btfnxPrice(tic), data.balanceBTC));
            }

            // If the ticker is below the minimum sell amount to break even, exit
            if (comparePrices(tic, self.lowestResistanceZone) < 1) return;

            // If this is the first sign of a sell, just record this moment
            if (!self.activeData.sellPrice || !self.activeData.sellTime) return setPossibleSell(tic);

            // If the ticker has risen since last time, just record this moment
            if (comparePrices(tic, self.activeData.sellPrice) === 1) return setPossibleSell(tic);

            // If the ticker has dropped below the highest price recorded, sell
            if (tic < getMaxDrop(self.activeData.sellPrice))
            {
                return placeOrder(sellOrder(btfnxPrice(tic), data.balanceBTC));
            }

            // If it's been long enough, sell
            if (self.activeData.sellTime + maxWait > Date.now())
            {
                return placeOrder(sellOrder(btfnxPrice(tic), data.balanceBTC));
            }
        }
    }

    function buyOrder(price, balanceUSD)
    {
        resetActiveData();

        // Make sure to round down & trim to correct number of decimals
        price = btfnxPrice(price);

        // Bitfinex goes up to 8 decimals maximum for trades
        var amount = toFixed(balanceUSD / price, 8);

        // Return that data to the app
        return {
            symbol: symbol,
            amount: String(amount),
            price: String(price),
            exchange: exchange,
            side: 'buy',
            type: type
        };
    }

    function sellOrder(price, balanceBTC)
    {
        // Make sure to round down & trim to correct number of decimals
        price = btfnxPrice(price);

        // Bitfinex goes up to 8 decimals maximum for trades
        var amount = toFixed(balanceBTC, 8);

        // Return that data to the app
        return {
            symbol: symbol,
            amount: String(amount),
            price: String(price),
            exchange: exchange,
            side: 'sell',
            type: type
        };
    }

    /* Private methods */
    function setPossibleSell(price)
    {
        self.activeData.sellPrice = price;
        self.activeData.sellTime = Date.now();
    }

    function setPossibleBuy(price)
    {
        self.activeData.buyPrice = price;
        self.activeData.buyTime = Date.now();
    }

    // The amount below the current price required for a buy
    function getSupportZone(price)
    {
        return parseFloat(price) * (1 - fees.maker);
    }

    // The amount below the current price required for a buy
    function getStopLossZone(price)
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
        var possiblePrice = parseFloat(price) * (1 - risk);

        // Just make sure the new price is actually lower even when rounded to the right
        // number of decimals
        if (btfnxPrice(possiblePrice) < btfnxPrice(price)) return possiblePrice;

        // If it is not, then just subtract the smallest possible unit to the price
        return price - 0.1;
    }

    // The price above the current buy position that would indicate
    // that the ticker will keep rising
    function getMaxIncrease(price)
    {
        var possiblePrice = parseFloat(price) * (1 + risk);

        // Just make sure the new price is actually higher even when rounded to the right
        // number of decimals
        if (btfnxPrice(possiblePrice) > btfnxPrice(price)) return possiblePrice;

        // If it is not, then just add the smallest possible unit to the price
        return price + 0.1;
    }

    // Utility to reset the active data when a trade is executed
    function resetActiveData()
    {
        self.activeData = {};
        self.highestSupportZone = null;
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
