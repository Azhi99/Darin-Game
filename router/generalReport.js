const db = require('../DB/dbConfig.js')
const express = require('express')
const router = express.Router()

//money movement

router.get('/moneyMovement/:from/:to', async(req,res) => {
    try {
        const [[{totalSale}]] = await db.raw(`SELECT ifnull(SUM(tbl_invoices.totalPrice),0) AS totalSale FROM tbl_invoices where date(tbl_invoices.createAt) between "${req.params.from}" and "${req.params.to}" and tbl_invoices.stockType = 's'`)
         const [[{totalPurchase}]] = await db.raw(`SELECT ifnull(SUM(tbl_purchases.totalPrice),0) AS totalPurchase FROM tbl_purchases where date(tbl_purchases.createAt) between "${req.params.from}" and "${req.params.to}" and tbl_purchases.stockType = 'p'`)
          const [[{totalDebtCustomer}]] = await db.raw(`SELECT IFNULL(SUM(tbl_return_debt_customer.amountReturn - tbl_return_debt_customer.discount),0) AS totalDebtCustomer FROM tbl_return_debt_customer where date(tbl_return_debt_customer.createAt) between "${req.params.from}" and "${req.params.to}"`)
           const [[{totalDebtCompany}]] = await db.raw(`SELECT ifnull(SUM(tbl_return_debt.amountReturn - tbl_return_debt.discount),0) AS totalDebtCompany FROM tbl_return_debt where date(tbl_return_debt.createAt) between "${req.params.from}" and "${req.params.to}"`)
          const [[{totalDiscountInvoice}]] = await db.raw(`SELECT IFNULL(SUM(tbl_invoices.discount),0) AS totalDiscountInvoice FROM tbl_invoices where date(tbl_invoices.createAt) between "${req.params.from}" and "${req.params.to}"`)
         const [[{totalDiscountPurchase}]] = await db.raw(`SELECT IFNULL(SUM(tbl_purchases.discount),0) AS totalDiscountPurchase FROM tbl_purchases where date(tbl_purchases.createAt) between "${req.params.from}" and "${req.params.to}"`)
        const [[{totalExpenseIQD}]] = await db.raw(`SELECT IFNULL(SUM(tbl_expenses.priceExpenseIQD),0) AS totalExpenseIQD FROM tbl_expenses where date(tbl_expenses.createAt) between "${req.params.from}" and "${req.params.to}"`)
       const [[{totalReturnSale}]] = await db.raw(`SELECT ifnull(SUM(tbl_invoices.totalPrice),0) AS totalReturnSale FROM tbl_invoices where date(tbl_invoices.createAt) between "${req.params.from}" and "${req.params.to}" and tbl_invoices.stockType = 'rs'`)
      const [[{totalReturnPurchase}]] = await db.raw(`SELECT ifnull(SUM(tbl_purchases.totalPrice),0) AS totalReturnPurchase FROM tbl_purchases where date(tbl_purchases.createAt) between "${req.params.from}" and "${req.params.to}" and tbl_purchases.stockType = 'rp'`)
     const [[{totalProfit}]] = await db.raw(`SELECT -1 * SUM(tbl_stock.qty * (tbl_stock.itemPrice - tbl_stock.costPrice)) AS totalProfit FROM tbl_stock WHERE sourceType IN ('s','rs') and date(tbl_stock.createAt) between "${req.params.from}" and "${req.params.to}" `)   
        res.status(200).send({
            totalSale,
            totalPurchase,
            totalDebtCustomer,
            totalDebtCompany,
            totalDiscountInvoice,
            totalDiscountPurchase,
            totalExpenseIQD,
            totalReturnSale,
            totalReturnPurchase,
            totalProfit
        })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/totalProfit/:from/:to', async(req,res) => {
    try {
        const [totalProfit] = await db.raw(`SELECT tbl_stock.sourceID, tbl_stock.sourceType, (-1) * SUM(tbl_stock.qty * (tbl_stock.itemPrice - tbl_stock.costPrice)) AS totalProfit, (-1) * SUM(tbl_stock.itemPrice * tbl_stock.qty) AS totalSale FROM tbl_stock WHERE tbl_stock.sourceType IN ('s', 'rs') and date(tbl_stock.createAt) between "${req.params.from}" and "${req.params.to}" GROUP BY tbl_stock.sourceID, tbl_stock.sourceType`)
        const [[{totalAll}]] = await db.raw(`select (-1) * SUM(tbl_stock.qty * (tbl_stock.itemPrice - tbl_stock.costPrice)) AS totalAll  FROM tbl_stock WHERE tbl_stock.sourceType IN ('s', 'rs') and date(tbl_stock.createAt) between "${req.params.from}" and "${req.params.to}"`)
        res.status(200).send({
            totalProfit,
            totalAll
        })
    } catch (error) {
        res.status(500).send(error)
    }
})

module.exports = router