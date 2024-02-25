import { APIGatewayProxyHandlerV2 } from "aws-lambda";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
	// Note change
	try {
		console.log("Event: ", event);
		const pathParameters = event?.pathParameters;
		const queryParameters = event?.queryStringParameters;

		const movieId = pathParameters?.movieId ? parseInt(pathParameters.movieId) : undefined;
		const shouldIncludeCast = queryParameters?.cast === "true";

		if (!movieId) {
			return {
				statusCode: 404,
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({ Message: "Missing movie Id" }),
			};
		}

		const commandOutput = await ddbDocClient.send(
			new GetCommand({
				TableName: process.env.TABLE_NAME,
				Key: { id: movieId },
			})
		);
		console.log("Movie Meta GetCommand response: ", commandOutput);
		if (!commandOutput.Item) {
			return {
				statusCode: 404,
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({ Message: "Invalid movie Id" }),
			};
		}

		if (shouldIncludeCast) {
			const castCommandOutput = await ddbDocClient.send(
				new QueryCommand({
					TableName: process.env.CAST_TABLE_NAME,
					KeyConditionExpression: "movieId = :m",
					ExpressionAttributeValues: { ":m": movieId },
				})
			);
			console.log("Cast QueryCommand response: ", commandOutput);

			Object.assign(commandOutput.Item, { cast: castCommandOutput.Items });
		}

		const body = {
			data: commandOutput.Item,
		};

		// Return Response
		return {
			statusCode: 200,
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
		};
	} catch (error: any) {
		console.log(JSON.stringify(error));
		return {
			statusCode: 500,
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({ error }),
		};
	}
};

function createDDbDocClient() {
	const ddbClient = new DynamoDBClient({ region: process.env.REGION });
	const marshallOptions = {
		convertEmptyValues: true,
		removeUndefinedValues: true,
		convertClassInstanceToMap: true,
	};
	const unmarshallOptions = {
		wrapNumbers: false,
	};
	const translateConfig = { marshallOptions, unmarshallOptions };
	return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
