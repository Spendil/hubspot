import fetch from 'node-fetch'
import mysql from 'mysql'
import ora from 'ora'
import dotenv from 'dotenv'
dotenv.config()
const spinner = ora('Waiting response from graphql')
const connection = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE
})

const getData = async () => {
	spinner.start()
	const response = await fetch("https://graphql.bitquery.io/", {
		"headers": {
			"accept": "application/json",
			"content-type": "application/json",
			"x-api-key": process.env.X_API_KEY,
		},
		"body": `{\"query\":\"query ($days30: ISO8601DateTime, $days7: ISO8601DateTime) {\\n\\t\\t\\tsystem {\\n\\t\\t\\t  userRequests {\\n\\t\\t\\t\\taccount {\\n\\t\\t\\t\\t  email\\n\\t\\t\\t\\t}\\n\\t\\t\\t\\tlast30days: countBigInt(date: {after: $days30})\\n\\t\\t\\t\\tlast7days: countBigInt(date: {after: $days7})\\n\\t\\t\\t\\tlastAPIcall: maximum(of: date get: date)\\n\\t\\t\\t  }\\n\\t\\t\\t}\\n\\t\\t}\",\"variables\":\"{\\n  \\\"days30\\\": \\\"${new Date( new Date().setDate( new Date().getDate() - 30 ) ).toISOString()}\\\",\\n  \\\"days7\\\": \\\"${new Date( new Date().setDate( new Date().getDate() - 7 ) ).toISOString()}\\\"\\n}\"}`,
		"method": "POST",
		"credentials": "same-origin"
	})
	spinner.succeed('Done!')
	const data = response.json()
	return data
};
const updateBatch = body => {
	return fetch(
		`https://api.hubapi.com/contacts/v1/contact/batch/?hapikey=${process.env.HAPIKEY}`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		},
	)
}
const { data } = await getData()
let body = []
data.system.userRequests
.filter(item => item.account.email !== '-' && item.account.email !== 'ide' && item.account.email !== 'admin' && item.account.email !== 'explorer')
.forEach(async (info, index, arr) => {
	let account = {}
	account.email = info.account.email
	account.properties = [
		{
			property: "last_30_days_api_calls",
			value: info.last30days
		},
		{
			property: "last_7_days_api_calls",
			value: info.last7days
		},
		{
			property: "number_of_days_last_api_call_made",
			value: Math.floor ( (new Date() - new Date( info.lastAPIcall ) ) / ( 1000 * 60 * 60 * 24 ) )
		},
		{
			property: "is_paying_customer_",
			value: false
		}
	]
	body.push(account)
	if (body.length && index%100 === 0) {
		const response = await updateBatch(body)
		console.log(response.status);
		body = []
	}
	body.push(account)
	if (index === arr.length-1) {
		const response = await updateBatch(body)
		console.log(response.status);
	}
})

connection.connect()
connection.query(
	`SELECT m1.*, (SELECT email FROM accounts WHERE id=m1.user_id) AS email
	FROM billing_periods m1
	LEFT JOIN billing_periods m2
	ON (m1.user_id = m2.user_id AND m1.id < m2.id)
	WHERE m2.id IS NULL AND m1.is_paid = 1;`,
	function(error, results, fields) {
		if (error) throw error
		const body = results.map(info => {
			return {
				email: info.email,
				properties: [{
					property: "is_paying_customer_",
					value: true
				}]
			}
		})
		updateBatch(body)
			.then(response => console.log(response.status))
			.catch(error => console.log(error))
})
connection.end()
