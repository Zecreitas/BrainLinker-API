const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    userType: {
        type: String,
        required: true,
        enum: ['cuidador', 'familiar/amigo'],
    },
    relation: {
        type: String,
        required: function() {
            return this.userType === 'familiar/amigo';
        },
    },
    nascDate: {
        type: Date,
        required: function() {
            return this.userType === 'familiar/amigo';
        },
    },
    connections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
