import { type Document } from 'mongodb';
import { getValueByPath } from './utils';

// Comparison Operators
function handleComparison(docValue: any, queryValue: any, operator: string): boolean {
    switch (operator) {
        case '$eq':
            if (docValue instanceof Date && queryValue instanceof Date) {
                return docValue.getTime() === queryValue.getTime();
            }
            return docValue === queryValue;
        case '$gt':
            return docValue > queryValue;
        case '$gte':
            return docValue >= queryValue;
        case '$lt':
            return docValue < queryValue;
        case '$lte':
            return docValue <= queryValue;
        case '$ne':
            if (docValue instanceof Date && queryValue instanceof Date) {
                return docValue.getTime() !== queryValue.getTime();
            }
            return docValue !== queryValue;
        case '$in':
            if (Array.isArray(queryValue)) {
                return queryValue.some(item => {
                    if (docValue instanceof Date && item instanceof Date) {
                        return docValue.getTime() === item.getTime();
                    }
                    return docValue === item;
                });
            }
            return false;
        case '$nin':
            if (Array.isArray(queryValue)) {
                return !queryValue.some(item => {
                    if (docValue instanceof Date && item instanceof Date) {
                        return docValue.getTime() === item.getTime();
                    }
                    return docValue === item;
                });
            }
            return true;
        default:
            return false;
    }
}

// Logical Operators
function handleLogical(doc: Document, queryValue: any, operator: string): boolean {
    switch (operator) {
        case '$and':
            if (!Array.isArray(queryValue)) {
                throw new Error('$and must be an Array of conditions');
            }
            return queryValue.every((subQuery: Document) => documentMatchesQuery(doc, subQuery));
        case '$or':
            if (!Array.isArray(queryValue)) {
                throw new Error('$or must be an Array of conditions');
            }
            return queryValue.some((subQuery: Document) => documentMatchesQuery(doc, subQuery));
        case '$not':
            return !documentMatchesQuery(doc, queryValue);
        case '$nor':
            if (!Array.isArray(queryValue)) {
                throw new Error('$nor must be an Array of conditions');
            }
            return !queryValue.some((subQuery: Document) => documentMatchesQuery(doc, subQuery));
        default:
            return false;
    }
}

function matchesBsonType(docValue: any, queryValue: any): boolean {
    // Helper function to get BSON type as string
    function getBsonType(value: any): string | null {
        if (value instanceof Date) return 'date';
        if (typeof value === 'string') return 'string';
        if (typeof value === 'boolean') return 'bool';
        if (typeof value === 'number') {
            if (Number.isInteger(value)) return 'int';
            return 'double';
        }
        if (Array.isArray(value)) return 'array';
        if (value instanceof RegExp) return 'regex';
        if (value !== undefined && value._bsontype === 'ObjectId') return 'objectId'; // Assuming you're using the MongoDB driver for Node.js
        if (value instanceof Buffer) return 'binData';
        if (value !== undefined && typeof value === 'object') return 'object';
        return null;
    }

    const mapping: Record<number, string> = {
        1: 'double',
        2: 'string',
        3: 'object',
        4: 'array',
        5: 'binData',
        7: 'objectId',
        8: 'bool',
        9: 'date',
        11: 'regex',
        16: 'int',
        18: 'long' // Note: JavaScript doesn't have a separate 'long' type, but this is for completeness
    };

    const docValueType = getBsonType(docValue);
    const expectedType = typeof queryValue === 'number' ? mapping[queryValue] : queryValue;

    return docValueType === expectedType;
}

// Element Operators
function handleElement(docValue: any, queryValue: any, operator: string): boolean {
    switch (operator) {
        case '$exists':
            return (docValue !== undefined) === queryValue;
        case '$type':
            return matchesBsonType(docValue, queryValue);
        default:
            return false;
    }
}

// Array Operators
function handleArray(docValue: any, queryValue: any, operator: string): boolean {
    if (!Array.isArray(docValue)) return false;

    switch (operator) {
        case '$all':
            return queryValue.every((val: any) => docValue.includes(val));
        case '$elemMatch':
            return docValue.some((val: any) => documentMatchesQuery(val, queryValue));
        case '$size':
            return docValue.length === queryValue;
        default:
            return false;
    }
}

function matchesMultipleWordsInAnyOrder(target: string, searchString: string): boolean {
    const words = searchString.split(/[\s.,;!?()]+/); // Split by whitespace and punctuation
    return words.every(word => {
        const regex = new RegExp(`\\b${word}\\b`); // Using word boundaries
        return regex.test(target);
    });
}

// Evaluation Operators
function handleEvaluation(docValue: any, queryValue: any, operator: string): boolean {
    switch (operator) {
        case '$mod':
            return queryValue[operator][0] === 0 ? false : (Math.abs(docValue % queryValue[operator][0]) === queryValue[operator][1]);
        case '$regex':
        {
            let regex: RegExp;

            // Check if $regex is already a RegExp object
            if (queryValue.$regex instanceof RegExp) {
                regex = queryValue.$regex;
            } else {
                // Construct a RegExp object using the provided pattern and options
                regex = new RegExp(queryValue.$regex, queryValue.$options);
            }

            return regex.test(docValue);
        }

        case '$text':
        {
            // Check if the caseSensitive option is set to true
            const isCaseSensitive = queryValue[operator].$caseSensitive === true;

            // Convert both the document value and search string to lowercase if not case-sensitive
            const searchValue = isCaseSensitive ? queryValue[operator].$search : queryValue[operator].$search.toLowerCase();
            const documentValue = isCaseSensitive ? docValue : docValue.toLowerCase();

            // Check if the document string value contains the search string
            return matchesMultipleWordsInAnyOrder(documentValue, searchValue);
        }
        default:
            return false;
    }
}

// Bitwise Operators
function handleBitwise(docValue: number, queryValue: number, operator: string): boolean {
    switch (operator) {
        case '$bitsAllClear':
            return (docValue & queryValue) === 0;
        case '$bitsAllSet':
            return (docValue & queryValue) === queryValue;
        case '$bitsAnyClear':
            return (docValue & queryValue) !== queryValue;
        case '$bitsAnySet':
            return (docValue & queryValue) !== 0;
        default:
            return false;
    }
}

function handleArithmetic(operator: string, value1: any, value2: any): any {
    switch (operator) {
        case '$add':
            return value1 + value2;
        case '$subtract':
            return value1 - value2;
        case '$multiply':
            return value1 * value2;
        case '$divide':
            if (value2 === 0) return false; // Avoid division by zero
            return value1 / value2;
        default:
            return false;
    }
}

function handleExpr(doc: Document, expr: any): boolean {
    if (expr === undefined || expr === null) return false;

    const operator = Object.keys(expr)[0];
    const values = expr[operator];

    // Evaluate the expressions
    const evaluateExpression = (expression: any): any => {
        if (typeof expression === 'string' && expression.startsWith('$')) {
            return getValueByPath(doc, expression.slice(1)); // Remove the $ and get the value
        }
        if (typeof expression === 'object') {
            return handleExpr(doc, expression);
        }
        return expression;
    };

    const value1 = evaluateExpression(values[0]);
    const value2 = evaluateExpression(values[1]);

    switch (operator) {
        case '$eq':
        case '$gt':
        case '$gte':
        case '$lt':
        case '$lte':
        case '$ne':
            return handleComparison(value1, value2, operator);
        case '$add':
        case '$subtract':
        case '$multiply':
        case '$divide':
            return handleArithmetic(operator, value1, value2);
        case '$cond':
        {
            let condition, trueCase, falseCase;

            // Determine if $cond is expressed as an array or embedded document
            if (Array.isArray(expr[operator])) {
                [condition, trueCase, falseCase] = expr[operator];
            } else {
                condition = expr[operator].if;
                trueCase = expr[operator].then;
                falseCase = expr[operator].else;
            }

            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            return evaluateExpression(condition) ? evaluateExpression(trueCase) : evaluateExpression(falseCase);
        }
        default:
            return false;
    }
}

// eslint-disable-next-line @typescript-eslint/ban-types
function handleWhere(doc: Document, whereCondition: string | Function): boolean {
    try {
        // If the whereCondition is a string, convert it to a function
        if (typeof whereCondition === 'string') {
            // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
            const whereFunction = new Function('doc', `return ${whereCondition}`);
            return whereFunction(doc);
        } else if (typeof whereCondition === 'function') {
            return whereCondition(doc);
        }
    } catch (error) {
        console.error('Error evaluating $where condition:', error);
    }
    return false;
}

// Main function
export function documentMatchesQuery(doc: Document, query: Document): boolean {
    for (const field in query) {
        const queryValue = query[field];
        const docValue = getValueByPath(doc, field);

        if (queryValue instanceof RegExp) {
            if (!queryValue.test(docValue)) return false;
        } else if (['$and', '$or', '$nor'].includes(field)) {
            if (!handleLogical(doc, queryValue, field)) return false;
        } else if (field === '$expr') {
            if (!handleExpr(doc, queryValue)) return false;
        } else if (typeof queryValue === 'object' && queryValue !== null) {
            const operator = Object.keys(queryValue)[0];

            if (['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin'].includes(operator)) {
                if (!handleComparison(docValue, queryValue[operator], operator)) return false;
            } else if (operator === '$not') {
                if (documentMatchesQuery(doc, { [field]: queryValue.$not })) return false;
            } else if (['$exists', '$type'].includes(operator)) {
                if (!handleElement(docValue, queryValue[operator], operator)) return false;
            } else if (['$all', '$elemMatch', '$size'].includes(operator)) {
                if (!handleArray(docValue, queryValue[operator], operator)) return false;
            } else if (operator === '$expr') {
                if (!handleExpr(doc, queryValue[operator])) return false;
            } else if (operator === '$where') {
                if (!handleWhere(doc, queryValue[operator])) return false;
            } else if (['$mod', '$regex', '$text'].includes(operator)) {
                if (!handleEvaluation(docValue, queryValue, operator)) return false;
            } else if (['$bitsAllClear', '$bitsAllSet', '$bitsAnyClear', '$bitsAnySet'].includes(operator)) {
                if (!handleBitwise(docValue, queryValue[operator], operator)) return false;
            } else if (documentMatchesQuery(docValue, queryValue)) {
                continue;
            } else {
                return false;
            }
        } else if (docValue instanceof Date && queryValue instanceof Date) {
            if (docValue.getTime() !== queryValue.getTime()) return false;
        } else if (docValue !== queryValue) {
            return false;
        }
    }

    return true;
}
