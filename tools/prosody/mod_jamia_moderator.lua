-- JAMIA ASHRAFIA LAHORE - WHO MODERATES A LIVE CLASS (installed by tools/jitsi-moderators.sh)
--
-- Only people whose LMS meeting token says so (the class's host: its teacher or an administrator) become
-- moderators when they join. Jicofo's "first person in becomes moderator" rule is turned off in jicofo.conf,
-- so students never become moderators on their own, whether or not the host is in the meeting.
-- A moderator can still make others moderators from the meeting (Grant moderator); that is left alone.
-- Loaded on the conference MUC component, after token_verification has checked the token.

local function token_says_moderator(session)
    local user = session and session.jitsi_meet_context_user;
    if not user then
        return false;
    end
    local flag = user.moderator;
    return flag == true or flag == "true" or user.affiliation == "owner";
end

module:hook("muc-occupant-pre-join", function (event)
    local room, occupant, session = event.room, event.occupant, event.origin;
    if not occupant or not token_says_moderator(session) then
        return;
    end
    -- The occupant's role was worked out before this event, so it is set here as well as the affiliation
    room:set_affiliation(true, occupant.bare_jid, "owner");
    occupant.role = "moderator";
    module:log("info", "%s joins %s as moderator (LMS host)", occupant.bare_jid, room.jid);
end, 2); -- after token_verification (99), which turns away anyone without a valid token

module:log("info", "Jamia live class moderators: only LMS hosts and people they grant");
