function logger(trader, sheet)
{
    const self = this;
    self.orderUpdate = orderUpdate;
    return self;

    /**
     * Utility to log an order/trade to google sheets
     */
    function orderUpdate(order)
    {
        const prettyOrder = order.sheetsFormat();
        if (!prettyOrder) return;
        sheet.recordMyTrade(prettyOrder).catch(function (err)
        {
            console.log("Could not record order to drive sheets");
            console.log(err);
        });
    }
}

module.exports = logger;
