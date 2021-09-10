const db = require('../DB/dbConfig.js')
const express = require('express')
const jwt = require('jsonwebtoken');
const router = express.Router()

router.post('/', async (req, res) => {
    try {
        const purchase = req.body.data
        purchase.createAt = new Date().toISOString().split("T")[0], purchase.updateAt = purchase.createAt
        purchase.userIDCreated = jwt.verify(req.headers.authorization.split(' ')[1], 'sulyMarket001'), purchase.userIDUpdate = jwt.verify(req.headers.authorization.split(' ')[1], 'sulyMarket001')

        const purchase_items = purchase.purchase_items
        delete purchase.purchase_items

        //insert purchase and return id of it
        const [purchase_id] = await db('tbl_purchases').insert(purchase)

        await purchase_items.forEach(async (item) => {
            await db('tbl_items').update({ itemPriceRetail: item.itemPriceRetail, costPrice: item.costPrice }).where('itemID', '=', item.itemID)
            delete item.itemPriceRetail
            item.purchaseID = purchase_id

            //insert item to purchase_items
            await db('tbl_purchase_items').insert(item)

            //insert to stock
            await db('tbl_stock').insert({
                sourceID: purchase_id,
                sourceType: purchase.stockType,
                itemID: item.itemID,
                qty: (purchase.stockType == 'rp' ? -1 * (item.qty) : item.qty),
                costPrice: item.costPrice,
            })
        })

        res.status(201).send()
    } catch (error) {
        res.status(500).send()
    }
})
router.post('/addItem', async (req, res) => {
    const item = req.body.itemm
    item.expiryDate = null;
    const retailPrice = item.itemPriceRetail
    delete item.itemPriceRetail
    const stockType = item.stockType
    delete item.stockType

    try {
        await db('tbl_items').update({ itemPriceRetail: retailPrice, costPrice: item.costPrice }).where('itemID', '=', item.itemID)

        await db('tbl_purchase_items').insert(item)

        await db('tbl_stock').insert({
            sourceID: item.purchaseID,
            sourceType: stockType,
            itemID: item.itemID,
            qty: (stockType == 'rp' ? -1 * (item.qty) : item.qty),
            costPrice: item.costPrice,
        })
        updateTotal(item.purchaseID)
        res.sendStatus(200)
    } catch (error) {
        console.log(error);
        res.sendStatus(500)
    }


})
router.patch('/updatePurchase', async (req, res) => {
    const purchase = req.body.data
    purchaseID = purchase.purchaseID
    delete purchase.purchaseID
    purchase.userIDCreated = jwt.verify(req.headers.authorization.split(' ')[1], 'sulyMarket001')
    purchase.updateAt = new Date().toISOString().split("T")[0]

    await db('tbl_purchases').update(purchase).where('purchaseID', '=', purchaseID)

    res.sendStatus(200)
})
router.patch('/updateItem', async (req, res) => {
    const item = req.body.data
    const stockType = item.stockType
    const pItemID = item.pItemID
    const total = item.tota;
    delete item.stockType; delete item.pItemID; delete item.total

    
    try {
        await db('tbl_items').update({ itemPriceRetail: item.itemPriceRetail, costPrice: item.costPrice }).where('itemID', '=', item.itemID)
        delete item.itemPriceRetail
        
        await db('tbl_purchase_items').update(item).where('pItemID', '=', pItemID)

        await db('tbl_stock').update({
            qty: (stockType == 'rp' ? -1 * (item.qty) : item.qty),
            costPrice: item.costPrice,
        }).where('sourceID', '=', item.purchaseID).andWhere('sourceType', '=', stockType).andWhere('itemID', '=', item.itemID)

        updateTotal(item.purchaseID)

        res.sendStatus(200)
    } catch (error) {
        console.log(error);
        res.sendStatus(500)
    }

})
router.delete('/deleteItem', async (req, res) => {
    console.log(1);
    const item = req.body
    const stockType = item.stockType
    delete item.stockType
    var deleted;

    try {
        await db('tbl_purchase_items').delete().where('pItemID', '=', item.pItemID)
        await db('tbl_stock').delete().where('sourceID', '=', item.purchaseID).andWhere('sourceType', '=', stockType).andWhere('itemID', '=', item.itemID)
        const purchase_items = await db('tbl_purchase_items').select().where('purchaseID', '=', item.purchaseID)
        if (purchase_items.length == 0)
            deleted = await db('tbl_purchases').delete().where('purchaseID', '=', item.purchaseID)
        
        updateTotal(item.purchaseID)
        return res.status(200).send({ force: deleted ? true : false })

    } catch (error) {
        res.sendStatus(500)
    }
})
router.get('/', (req, res) => {
    const page = req.query.page

    const fields = [
        'tp.purchaseID', 'tp.supplierID', 'ts.supplierName',
        'tp.referenceNo', 'tp.totalPrice', 'tp.paymentType',
        'tp.purchaseStatus', 'tu.userID', 'tu.userName'
    ]

    db('tbl_purchases as tp')
        .join('tbl_suppliers as ts', 'ts.supplierID', 'tp.supplierID')
        .join('tbl_users as tu', 'tu.userID', 'tp.userIDUpdate')
        .offset((page - 1) * 20).limit(20)
        .select(fields).orderBy([{ column: 'purchaseID', order: 'desc' }])
        .then(purchases => {
            db('tbl_purchases').count('* as count')
                .then(([{ count }]) => {
                    res.send({ nop: count, purchases })
                })

        })
})


router.get('/getSupplier', async (req, res) => {
    try {
        const suppliers = await db('tbl_suppliers').select('supplierID', 'supplierName').where('supplierName', 'like', `${req.query.name}%`)
        res.send(suppliers)
    } catch (error) {
        console.log(error);
        res.status(500).send()
    }


})


router.get('/getItems', async (req, res) => {
    try {
        const items = await db('tbl_items').select('itemID', 'itemName', 'itemCode', 'costPrice', 'itemPriceRetail').where('itemCode', 'like', `${req.query.name}%`).orWhere('itemName', 'like', `${req.query.name}%`)
        res.send(items)
    } catch (error) {
        console.log(error)
        res.status(500).send()
    }
})


router.get('/:id', async (req, res) => {
    const [purchase] = await db('tbl_purchases').select().where('purchaseID', '=', req.params.id)
    purchase.purchase_items = await db('tbl_purchase_items').select().where('purchaseID', '=', req.params.id)


    var p = new Promise(async (resolve, reject) => {
        await purchase.purchase_items.forEach(async (item, index, array) => {
            const [items] = await db('tbl_items').select('itemID', 'itemName', 'itemCode', 'costPrice', 'itemPriceRetail').where('itemID', '=', item.itemID)
            purchase.purchase_items[index].item = { ...items }
            purchase.purchase_items[index].item.menu = false
            if (index == array.length - 1) {
                const [supplier] = await db('tbl_suppliers').select('supplierID', 'supplierName').where('supplierID', '=', purchase.supplierID)
                resolve(supplier)
            }
        })


    })

    p.then(async (supplier) => {
        purchase.suppliers = await { ...supplier }
        res.send(purchase)
    })


})

const updateTotal = (purchaseID) =>{
    db.raw(`UPDATE 'tbl_purchases' SET 'totalPrice'= ( SELECT SUM('qty' * 'costAfterDisc') FROM 'tbl_purchase_items' WHERE 'purchaseID' = ${purchaseID} ) WHERE 'purchaseID' = ${purchaseID};`)
}
module.exports = router