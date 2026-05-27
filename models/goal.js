const {Schema, model} = require('mongoose')

const GoalSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    type: {
        type: String,
        enum: ['książki', 'strony'],
        required: true,
        default: 'książki'
    },
    target: {
        type: Number,
        required: true
    },
    period: {
        type: String,
        enum: ['dzień','tydzień', 'miesiąc', 'rok'],
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    month: {
        type: Number,
        min: 1,
        max: 12
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    bookId: {
        type: Schema.Types.ObjectId,
        ref: 'book',
        default: null
    },
    bookTitle: {
        type: String,
        default: null
    }
})

module.exports = model('goal', GoalSchema)