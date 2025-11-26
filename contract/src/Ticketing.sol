// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./TargetBase.sol";

/// @title TicketingTarget
/// @notice Production ticketing system with KRNL authorization.
/// @dev All protected functions require AuthData as the first argument.
contract TicketingTarget is TargetBase {
    // ---------- Events ----------
    event EventCreated(uint256 indexed eventId, address indexed organizer);
    event TicketPurchased(uint256 indexed eventId, address indexed buyer, uint32 code, uint256 price);
    event TicketVerified(uint256 indexed eventId, uint32 code, address owner, bool redeemed);
    event FundsWithdrawn(uint256 indexed eventId, uint256 amount, address indexed to);

    // ---------- Errors ----------
    error InvalidInput();
    error EventNotFound();
    error NotOrganizer();
    error EventInactive();
    error SoldOut();
    error CodeAlreadyExists();
    error CodeNotFound();
    error PriceMismatch();
    error AlreadyRedeemed();
    error NothingToWithdraw();

    // ---------- Structs ----------
    struct Event {
        address organizer;
        string name;
        string description;
        string host;
        string location;
        uint64 startTime;
        uint32 maxPeople;
        uint32 minted;
        uint256 priceWei;
        bool active;
    }

    struct Ticket {
        address owner;
        bool redeemed;
    }

    // ---------- Storage ----------
    uint256 public totalEvents;
    mapping(uint256 => Event) private _events;

    mapping(uint256 => mapping(uint32 => Ticket)) private _tickets;
    mapping(uint256 => mapping(uint32 => bool)) private _ticketExists;

    mapping(uint256 => uint256) private _eventBalance;

    constructor(
        address masterKey,
        address recoveryKey,
        address owner_,
        address delegatedAccountImpl
    ) TargetBase(masterKey, recoveryKey, owner_, delegatedAccountImpl) {}

    // ====================================================
    //                       VIEW
    // ====================================================

    function getEvent(uint256 id) external view returns (Event memory) {
        if (_events[id].organizer == address(0)) revert EventNotFound();
        return _events[id];
    }

function getEvents(uint256 start, uint256 count) external view returns (Event[] memory out) {
    if (start >= totalEvents || count == 0) return new Event[](0);

    uint256 end = start + count;
    if (end > totalEvents) end = totalEvents;

    uint256 n = end - start;
    out = new Event[](n);
    for (uint256 i = 0; i < n; i++) {
        out[i] = _events[start + i];
    }
}


    function ticketOwner(uint256 eventId, uint32 code) external view returns (address) {
        if (!_ticketExists[eventId][code]) revert CodeNotFound();
        return _tickets[eventId][code].owner;
    }

    function eventBalance(uint256 eventId) external view returns (uint256) {
        return _eventBalance[eventId];
    }

    // ====================================================
    //                   CREATE EVENT
    // ====================================================

    /// @notice Create an event.
    /// @param authData KRNL / TargetBase authorization.
    function createEvent(
        AuthData calldata authData,
        string calldata name,
        string calldata description,
        string calldata host,
        string calldata location,
        uint64 startTime,
        uint32 maxPeople,
        uint256 priceWei
    ) external requireAuth(authData) returns (uint256 eventId) {
        if (bytes(name).length == 0 || maxPeople == 0) revert InvalidInput();

        eventId = totalEvents++;

        _events[eventId] = Event({
            organizer: msg.sender,
            name: name,
            description: description,
            host: host,
            location: location,
            startTime: startTime,
            maxPeople: maxPeople,
            minted: 0,
            priceWei: priceWei,
            active: true
        });

        emit EventCreated(eventId, msg.sender);
    }

    // ====================================================
    //                   BUY TICKET
    // ====================================================

    /// @notice Buy a ticket for an event.
    /// @param authData Authorization, required by TargetBase.
    /// @param eventId The event to buy for.
    /// @param code A unique 6-digit code generated OFF-CHAIN (and signed).
    /// @param buyer Logical owner of the ticket (can differ from delegated caller).
    function buyTicket(
        AuthData calldata authData,
        uint256 eventId,
        uint32 code,
        address buyer
    ) external payable requireAuth(authData) {
        Event storage e = _events[eventId];
        if (e.organizer == address(0)) revert EventNotFound();
        if (!e.active) revert EventInactive();
        if (e.minted >= e.maxPeople) revert SoldOut();
        if (buyer == address(0)) revert InvalidInput();
        if (_ticketExists[eventId][code]) revert CodeAlreadyExists();

        // payment
        if (e.priceWei > 0) {
            if (msg.value != e.priceWei) revert PriceMismatch();
            _eventBalance[eventId] += msg.value;
        } else {
            if (msg.value != 0) revert PriceMismatch();
        }

        _ticketExists[eventId][code] = true;
        _tickets[eventId][code] = Ticket({owner: buyer, redeemed: false});

        e.minted++;

        emit TicketPurchased(eventId, buyer, code, e.priceWei);
    }

    // ====================================================
    //                   VERIFY TICKET
    // ====================================================

    /// @notice Verify a ticket.
    /// @param markRedeemed If true, mark ticket as redeemed (one-time use).
    function verifyTicket(
        AuthData calldata authData,
        uint256 eventId,
        uint32 code,
        bool markRedeemed
    ) external requireAuth(authData) returns (bool valid, address owner) {
        if (!_ticketExists[eventId][code]) revert CodeNotFound();

        Ticket storage t = _tickets[eventId][code];
        owner = t.owner;
        valid = (owner != address(0));

        if (markRedeemed) {
            if (t.redeemed) revert AlreadyRedeemed();
            t.redeemed = true;
        }

        emit TicketVerified(eventId, code, owner, t.redeemed);
    }

    // ====================================================
    //                 ORGANIZER WITHDRAW
    // ====================================================

    function withdraw(
        AuthData calldata authData,
        uint256 eventId,
        address payable to
    ) external requireAuth(authData) {
        Event storage e = _events[eventId];
        if (e.organizer == address(0)) revert EventNotFound();
        if (msg.sender != e.organizer && msg.sender != owner()) revert NotOrganizer();

        uint256 bal = _eventBalance[eventId];
        if (bal == 0) revert NothingToWithdraw();

        _eventBalance[eventId] = 0;

        (bool ok, ) = to.call{value: bal}("");
        require(ok, "transfer failed");

        emit FundsWithdrawn(eventId, bal, to);
    }
}
