'use strict';

const FILE   = require('fs');
const ICONVL = require('iconv-lite');
const FTRACE = include('JTrace');


var HeaderConfig = {
    length: {
        pos: 0,
        alpha: 0,
        arridx: 0
    }
};

module.exports.buildHead = function(telegram) {

    var offset = 0;
    var pos, dpos, dataobj, dmpos;
    // Packet Herd
    for( pos=0; pos< JConfig.PACKET_HeaderArray.length; pos++ ) {
        var field = JConfig.PACKET_HeaderArray[pos];

        var value = telegram.packet.slice(offset, offset+Number(field.size));
        switch( field.type ) {
        case '9':
            value = Number(value);
            break;
        case 'B':
            break;
        case 'X':
        default:
            value = ICONVL.decode(value, 'euc-kr');
            value = (value||'').toString().trimRight();
            break;
        }
        telegram.Phead[field.name] = value;
        offset += Number(field.size);
    }
    telegram.Phead.length = offset;
    telegram.body.length = telegram.packet.length - offset;
    if(telegram.body.length > 0)
    {
        for( dpos=0; dpos< telegram.Phead.P_RecordCount; dpos++ )
        {
            for( pos=0; pos< JConfig.DATA_Array.length; pos++ ) {
                var field = JConfig.DATA_Array[pos];

                var value = telegram.packet.slice(offset, offset+Number(field.size));
                switch( field.type ) {
                case '9':
                    value = Number(value);
                    break;
                case 'B':
                    break;
                case 'X':
                default:
                    value = ICONVL.decode(value, 'euc-kr');
                    value = (value||'').toString().trimRight();
                    break;
                }
                telegram.Dhead[dpos].Dhead[field.name] = value;
                offset += Number(field.size);
            }
            for( pos=0; pos< JConfig.DATA_ArrayMSG.length; pos++ ) {
                var field = JConfig.DATA_ArrayMSG[pos];

                var value = telegram.packet.slice(offset, offset+Number(field.size));
                switch( field.type ) {
                case '9':
                    value = Number(value);
                    break;
                case 'B':
                    break;
                case 'X':
                default:
                    value = ICONVL.decode(value, 'euc-kr');
                    value = (value||'').toString().trimRight();
                    break;
                }
                telegram.Dhead[dpos].Dmsg[field.name] = value;
                offset += Number(field.size);
            }
            for( dmpos=0; dmpos< telegram.Dhead[dpos].Dmsg.send_cnt; dmpos++ )
            {
                dataobj = {};
                for( pos=0; pos< JConfig.DATA_ArrayDATA.length; pos++ ) {
                    var field = JConfig.DATA_ArrayDATA[pos];

                    var value = telegram.packet.slice(offset, offset+Number(field.size));
                    switch( field.type ) {
                    case '9':
                        value = Number(value);
                        break;
                    case 'B':
                        break;
                    case 'X':
                    default:
                        value = ICONVL.decode(value, 'euc-kr');
                        value = (value||'').toString().trimRight();
                        break;
                    }
                    dataobj[field.name] = value;
                    offset += Number(field.size);
                }
                telegram.Dhead[dpos].Data.push(dataobj);
            }
        }
    }
    return telegram;
}

function getFmtDate() {
    var dt_now = new Date();
    return dt_now.getFullYear()
        + ("00" + (dt_now.getMonth() + 1)).slice(-2)
        + ("00" + dt_now.getDate()).slice(-2);
}

function getFmtTime() {
    var dt_now = new Date();
    return ("00" + dt_now.getHours()).slice(-2)
        + ("00" + dt_now.getMinutes()).slice(-2)
        + ("00" + dt_now.getSeconds()).slice(-2)
        + ("000" + dt_now.getMilliseconds()).slice(-3);
}

module.exports.setPacketLength = function(packet, length) {
    var field_length = JConfig.PACKET_HeaderArray[HeaderConfig.length.arridx];
    var length_pos = Number(HeaderConfig.length.pos);
    var length_len = Number(field_length.size);
    length_len -= 6;
    var length_val = length.toString();
    length_val = length_val.padStart(length_len, '0');

    packet.write(length_val, length_pos, length_len);
    return packet;
}

module.exports.makeAconnect = function(agram, gun) {
    var headerA = Buffer.alloc(0);
    var posA;
    agram.P_TotalLength = 80;
    agram.P_TransactionType = 'A';
    agram.P_Port = JConfig.port;
    agram.P_SN_TYPE = gun;
    agram.P_Sequence = '        ';
    agram.P_RecordCount = 1;
    agram.P_RequestType = 'Q';
    agram.P_ResponseCode = 0;
    agram.P_RetryCount = 0;
    agram.P_DATE = getFmtDate();;
    agram.P_TIME = getFmtTime();
    agram.P_UUID = '                                ';
    agram.P_FILLER = '      ';

    for( posA=0; posA< JConfig.PACKET_HeaderArray.length; posA++ ) {
        var column = JConfig.PACKET_HeaderArray[posA] || '';
        var value = agram[column.name] || '';

        value = value.toString();
        switch( column.type ) {
        case '9':
            if(column.name === 'P_Sequence')
            {
                value = value.padEnd(column.size);
                value = Buffer.from(ICONVL.encode(value, 'euc-kr'));
                value = value.slice(0, column.size);
            }
            else{
                value = Buffer.from( value.padStart(column.size, '0') );
                value = value.slice(0, column.size);
            }
            break;
        case 'X':
        default:
            value = value.padEnd(column.size);
            value = Buffer.from(ICONVL.encode(value, 'euc-kr'));
            value = value.slice(0, column.size);
            break;
        }
        headerA = Buffer.concat([headerA, value]);
    }
    return headerA;
}

module.exports.makeHeader = function(telegram, gun, dev) {
    //telegram.P_Port = JConfig.port;
    telegram.P_UUID = "                                ";
    telegram.P_FILLER = "      ";
    //telegram.P_RecordCount = "001";
    //telegram.P_ResponseCode = "0000";
    //telegram.P_RetryCount = "00";
    telegram.P_DATE = getFmtDate();
    telegram.P_TIME= getFmtTime();
    // Request에의한 전문 생성이면 'R' 아니면 'Q'...
    if( gun === '2' )
    {
        telegram.P_RequestType = 'R';
        telegram.P_TotalLength = 80;
    }
    else if(gun === '0')
    {
        telegram.P_RequestType = 'R';
    }

    telegram.P_SN_TYPE = dev;

    var header = Buffer.alloc(0);
    var pos;

    for( pos=0; pos< JConfig.PACKET_HeaderArray.length; pos++ ) {
        var column = JConfig.PACKET_HeaderArray[pos] || '';
        var value = telegram[column.name] || '';

        value = value.toString();
        switch( column.type ) {
        case '9':
            value = Buffer.from( value.padStart(column.size, '0') );
            value = value.slice(0, column.size);
            break;
        case 'X':
        default:
            value = value.padEnd(column.size);
            value = Buffer.from(ICONVL.encode(value, 'euc-kr'));
            value = value.slice(0, column.size);
            break;
        }
        header = Buffer.concat([header, value]);
    }
    
    return header;
}
