const {Schema, model} = require('mongoose')

const BookSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    title: { 
        type: String, 
        required: true 
    },
    author: { 
        type: String, 
        required: true 
    },
    genre: { 
        type: String, 
        required: true 
    },
    year: { 
        type: Number, 
        required: true 
    },
    notes: { 
        type: String, 
        default: '' 
    },

    read: {
         type: Boolean, 
         default: false 
        },
    bookFile: { 
        type: String, 
        default: null 
    },
    fileFormat: {
        type: String,
        enum: ['pdf', 'epub', 'fb2', 'mobi'],
        default: null
    },
    pages: { 
        type: Number, 
        default: 0 
    },       
    currentPage: { 
        type: Number, 
        default: 0 
    },  
    readingProgress: { 
        type: Number, 
        default: 0 
    },
    lastReadAt: { 
        type: Date, 
        default: null 
    },

    coverImage: { 
        type: String, 
        default: null 
    },

    readingHistory: [{
        date: { type: String },        
        pagesRead: { type: Number, default: 0 },
        pageStart: { type: Number, default: 0 },
        pageEnd: { type: Number, default: 0 }
    }],

    readerBookmarks: [{
        chapterTitle: String,
        scrollPercent: Number,
        currentPage: Number,
        createdAt: { type: Date, default: Date.now }
    }],

    readerNotes: [{
        selectedText: String,
        noteText: String,
        createdAt: { type: Date, default: Date.now }
    }]
})

module.exports = model('book', BookSchema)