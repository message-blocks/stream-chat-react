// @ts-check
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import deepequal from 'deep-equal';

import MessageSimple from './MessageSimple';
import { Attachment } from '../Attachment';
import { MESSAGE_ACTIONS } from '../../utils';
import { withTranslationContext } from '../../context';

/**
 * Message - A high level component which implements all the logic required for a message.
 * The actual rendering of the message is delegated via the "Message" property
 *
 * @example ../../docs/Message.md
 * @extends Component
 */
class Message extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
    };
  }

  static propTypes = {
    /** The message object */
    message: PropTypes.object.isRequired,
    /** The client connection object for connecting to Stream */
    client: PropTypes.object.isRequired,
    /** The current channel this message is displayed in */
    channel: PropTypes.object.isRequired,
    /** A list of users that have read this message */
    readBy: PropTypes.array,
    /** groupStyles, a list of styles to apply to this message. ie. top, bottom, single etc */
    groupStyles: PropTypes.array,
    /** Editing, if the message is currently being edited */
    editing: PropTypes.bool,
    /**
     * Message UI component to display a message in message list.
     * Available from [channel context](https://getstream.github.io/stream-chat-react/#channelcontext)
     * */
    Message: PropTypes.elementType,
    /**
     * Attachment UI component to display attachment in individual message.
     * Available from [channel context](https://getstream.github.io/stream-chat-react/#channelcontext)
     * */
    Attachment: PropTypes.elementType,
    /** render HTML instead of markdown. Posting HTML is only allowed server-side */
    unsafeHTML: PropTypes.bool,
    /**
     * Array of allowed actions on message. e.g. ['edit', 'delete', 'mute', 'flag']
     * If all the actions need to be disabled, empty array or false should be provided as value of prop.
     * */
    messageActions: PropTypes.oneOfType([PropTypes.bool, PropTypes.array]),
    /**
     * Function that returns message/text as string to be shown as notification, when request for flagging a message is successful
     *
     * This function should accept following params:
     *
     * @param message A [message object](https://getstream.io/chat/docs/#message_format) which is flagged.
     *
     * */
    getFlagMessageSuccessNotification: PropTypes.func,
    /**
     * Function that returns message/text as string to be shown as notification, when request for flagging a message runs into error
     *
     * This function should accept following params:
     *
     * @param message A [message object](https://getstream.io/chat/docs/#message_format) which is flagged.
     *
     * */
    getFlagMessageErrorNotification: PropTypes.func,
    /**
     * Function that returns message/text as string to be shown as notification, when request for muting a user is successful
     *
     * This function should accept following params:
     *
     * @param user A user object which is being muted
     *
     * */
    getMuteUserSuccessNotification: PropTypes.func,
    /**
     * Function that returns message/text as string to be shown as notification, when request for muting a user runs into error
     *
     * This function should accept following params:
     *
     * @param user A user object which is being muted
     *
     * */
    getMuteUserErrorNotification: PropTypes.func,
    /** Latest message id on current channel */
    lastReceivedId: PropTypes.string,
    /** DOMRect object for parent MessageList component */
    messageListRect: PropTypes.object,
    /** @see See [Channel Context](https://getstream.github.io/stream-chat-react/#channelcontext) */
    members: PropTypes.object,
    /**
     * Function to add custom notification on messagelist
     *
     * @param text Notification text to display
     * @param type Type of notification. 'success' | 'error'
     * */
    addNotification: PropTypes.func,
    /** Sets the editing state */
    setEditingState: PropTypes.func,
    /** @see See [Channel Context](https://getstream.github.io/stream-chat-react/#channelcontext) */
    updateMessage: PropTypes.func,
    /** @see See [Channel Context](https://getstream.github.io/stream-chat-react/#channelcontext) */
    removeMessage: PropTypes.func,
    /** @see See [Channel Context](https://getstream.github.io/stream-chat-react/#channelcontext) */
    retrySendMessage: PropTypes.func,
    /** @see See [Channel Context](https://getstream.github.io/stream-chat-react/#channelcontext) */
    onMentionsClick: PropTypes.func,
    /** @see See [Channel Context](https://getstream.github.io/stream-chat-react/#channelcontext) */
    onMentionsHover: PropTypes.func,
    /**
     * The handler for click event on the user that posted the message
     *
     * @param event Dom click event which triggered handler.
     * @param user the User object for the corresponding user.
     */
    onUserClick: PropTypes.func,
    /**
     * The handler for hover events on the user that posted the message
     *
     * @param event Dom hover event which triggered handler.
     * @param user the User object for the corresponding user.
     */
    onUserHover: PropTypes.func,
    /** @see See [Channel Context](https://getstream.github.io/stream-chat-react/#channelcontext) */
    openThread: PropTypes.func,
    /** Handler to clear the edit state of message. It is defined in [MessageList](https://getstream.github.io/stream-chat-react/#messagelist) component */
    clearEditingState: PropTypes.func,
    /**
     * Additional props for underlying MessageInput component.
     * Available props - https://getstream.github.io/stream-chat-react/#messageinput
     * */
    additionalMessageInputProps: PropTypes.object,
    /**
     * The component that will be rendered if the message has been deleted.
     * All props are passed into this component.
     */
    MessageDeleted: PropTypes.elementType,
  };

  static defaultProps = {
    Message: MessageSimple,
    readBy: [],
    groupStyles: [],
    Attachment,
    editing: false,
    messageActions: Object.keys(MESSAGE_ACTIONS),
  };

  shouldComponentUpdate(nextProps) {
    // since there are many messages its important to only rerender messages when needed.
    let shouldUpdate = nextProps.message !== this.props.message;
    let reason = '';
    if (shouldUpdate) {
      reason = 'message';
    }
    // read state is the next most likely thing to change..
    if (!shouldUpdate && !deepequal(nextProps.readBy, this.props.readBy)) {
      shouldUpdate = true;
      reason = 'readBy';
    }
    // group style often changes for the last 3 messages...
    if (
      !shouldUpdate &&
      !deepequal(nextProps.groupStyles, this.props.groupStyles)
    ) {
      shouldUpdate = true;
      reason = 'groupStyles';
    }

    // if lastreceivedId changesm, message should update.
    if (
      !shouldUpdate &&
      !deepequal(nextProps.lastReceivedId, this.props.lastReceivedId)
    ) {
      shouldUpdate = true;
      reason = 'lastReceivedId';
    }

    // editing is the last one which can trigger a change..
    if (!shouldUpdate && nextProps.editing !== this.props.editing) {
      shouldUpdate = true;
      reason = 'editing';
    }

    // editing is the last one which can trigger a change..
    if (
      !shouldUpdate &&
      nextProps.messageListRect !== this.props.messageListRect
    ) {
      shouldUpdate = true;
      reason = 'messageListRect';
    }

    if (shouldUpdate && reason) {
      // console.log(
      //   'message',
      //   nextProps.message.id,
      //   'shouldUpdate',
      //   shouldUpdate,
      //   reason,
      // );
      // console.log(reason, diff(this.props, nextProps));
    }

    return shouldUpdate;
  }

  isMyMessage = (message) => this.props.client.user.id === message.user.id;

  isAdmin = () =>
    this.props.client.user.role === 'admin' ||
    (this.props.channel.state &&
      this.props.channel.state.membership &&
      this.props.channel.state.membership.role === 'admin');

  isOwner = () =>
    this.props.channel.state &&
    this.props.channel.state.membership &&
    this.props.channel.state.membership.role === 'owner';

  isModerator = () =>
    this.props.channel.state &&
    this.props.channel.state.membership &&
    (this.props.channel.state.membership.role === 'channel_moderator' ||
      this.props.channel.state.membership.role === 'moderator');

  canEditMessage = (message) =>
    this.isMyMessage(message) ||
    this.isModerator() ||
    this.isOwner() ||
    this.isAdmin();

  canDeleteMessage = (message) => this.canEditMessage(message);

  /**
   * Following function validates a function which returns notification message.
   * It validates if the first parameter is function and also if return value of function is string or no.
   *
   * @param func {Function}
   * @param args {Array} Arguments to be provided to func while executing.
   */
  validateAndGetNotificationMessage = (func, args) => {
    if (!func || typeof func !== 'function') return false;

    const returnValue = func(...args);

    if (typeof returnValue !== 'string') return false;

    return returnValue;
  };

  handleFlag = async (event) => {
    event.preventDefault();

    const {
      getFlagMessageSuccessNotification,
      getFlagMessageErrorNotification,
      message,
      client,
      addNotification,
      t,
    } = this.props;

    try {
      await client.flagMessage(message.id);
      const successMessage = this.validateAndGetNotificationMessage(
        getFlagMessageSuccessNotification,
        [message],
      );
      addNotification(
        successMessage || t('Message has been successfully flagged'),
        'success',
      );
    } catch (e) {
      const errorMessage = this.validateAndGetNotificationMessage(
        getFlagMessageErrorNotification,
        [message],
      );
      addNotification(
        errorMessage ||
          t(
            'Error adding flag: Either the flag already exist or there is issue with network connection ...',
          ),
        'error',
      );
    }
  };

  handleMute = async (event) => {
    event.preventDefault();

    const {
      getMuteUserSuccessNotification,
      getMuteUserErrorNotification,
      message,
      client,
      addNotification,
      t,
    } = this.props;
    if (!this.isUserMuted()) {
      try {
        await client.muteUser(message.user.id);
        const successMessage = this.validateAndGetNotificationMessage(
          getMuteUserSuccessNotification,
          [message.user],
        );

        addNotification(
          successMessage ||
            t(`{{ user }} has been muted`, {
              user: message.user.name || message.user.id,
            }),
          'success',
        );
      } catch (e) {
        const errorMessage = this.validateAndGetNotificationMessage(
          getMuteUserErrorNotification,
          [message.user],
        );

        addNotification(errorMessage || t('Error muting a user ...'), 'error');
      }
    } else {
      try {
        await client.unmuteUser(message.user.id);
        const successMessage = this.validateAndGetNotificationMessage(
          getMuteUserSuccessNotification,
          [message.user],
        );

        addNotification(
          successMessage ||
            t(`{{ user }} has been unmuted`, {
              user: message.user.name || message.user.id,
            }),
          'success',
        );
      } catch (e) {
        const errorMessage = this.validateAndGetNotificationMessage(
          getMuteUserErrorNotification,
          [message.user],
        );

        addNotification(
          errorMessage || t('Error unmuting a user ...'),
          'error',
        );
      }
    }
  };

  handleEdit = (event) => {
    const { setEditingState, message } = this.props;

    if (event !== undefined && event.preventDefault) {
      event.preventDefault();
    }

    setEditingState(message);
  };

  handleDelete = async (event) => {
    event.preventDefault();
    const { message, client, updateMessage } = this.props;
    const data = await client.deleteMessage(message.id);
    updateMessage(data.message);
  };

  handleReaction = async (reactionType, event) => {
    if (event !== undefined && event.preventDefault) {
      event.preventDefault();
    }

    let userExistingReaction = null;

    const currentUser = this.props.client.userID;
    this.props.message.own_reactions.forEach((reaction) => {
      // own user should only ever contain the current user id
      // just in case we check to prevent bugs with message updates from breaking reactions
      if (currentUser === reaction.user.id && reaction.type === reactionType) {
        userExistingReaction = reaction;
      } else if (currentUser !== reaction.user.id) {
        console.warn(
          `message.own_reactions contained reactions from a different user, this indicates a bug`,
        );
      }
    });

    const originalMessage = this.props.message;
    let reactionChangePromise;

    /*
    - Add the reaction to the local state
    - Make the API call in the background
    - If it fails, revert to the old message...
     */
    if (userExistingReaction) {
      // this.props.channel.state.removeReaction(userExistingReaction);

      reactionChangePromise = this.props.channel.deleteReaction(
        this.props.message.id,
        userExistingReaction.type,
      );
    } else {
      // add the reaction
      const messageID = this.props.message.id;

      const reaction = { type: reactionType };

      // this.props.channel.state.addReaction(tmpReaction, this.props.message);
      reactionChangePromise = this.props.channel.sendReaction(
        messageID,
        reaction,
      );
    }

    try {
      // only wait for the API call after the state is updated
      await reactionChangePromise;
    } catch (e) {
      // revert to the original message if the API call fails
      this.props.updateMessage(originalMessage);
    }
  };

  handleAction = async (name, value, event) => {
    event.preventDefault();
    const messageID = this.props.message.id;
    const formData = {};
    formData[name] = value;

    const data = await this.props.channel.sendAction(messageID, formData);

    if (data && data.message) {
      this.props.updateMessage(data.message);
    } else {
      this.props.removeMessage(this.props.message);
    }
  };

  handleRetry = async (message) => {
    await this.props.retrySendMessage(message);
  };

  onMentionsClick = (e) => {
    if (typeof this.props.onMentionsClick !== 'function') {
      return;
    }
    this.props.onMentionsClick(e, this.props.message.mentioned_users);
  };

  onMentionsHover = (e) => {
    const { onMentionsHover, message } = this.props;

    if (typeof onMentionsHover !== 'function') {
      return;
    }

    onMentionsHover(e, message.mentioned_users);
  };

  onUserClick = (e) => {
    if (typeof this.props.onUserClick !== 'function') {
      return;
    }

    this.props.onUserClick(e, this.props.message.user);
  };

  onUserHover = (e) => {
    if (typeof this.props.onUserHover !== 'function') {
      return;
    }

    this.props.onUserHover(e, this.props.message.user);
  };

  isUserMuted = () => {
    const userMuted = this.props.mutes.filter(
      (el) => el.target.id === this.props.message.user.id,
    );
    return !!userMuted.length;
  };

  getMessageActions = () => {
    const { message, messageActions: messageActionsProps } = this.props;
    const { mutes } = this.props.channel.getConfig();

    const messageActionsAfterPermission = [];
    let messageActions = [];

    if (messageActionsProps && typeof messageActionsProps === 'boolean') {
      // If value of messageActionsProps is true, then populate all the possible values
      messageActions = Object.keys(MESSAGE_ACTIONS);
    } else if (messageActionsProps && messageActionsProps.length > 0) {
      messageActions = [...messageActionsProps];
    } else {
      return [];
    }

    if (
      this.canEditMessage(message) &&
      messageActions.indexOf(MESSAGE_ACTIONS.edit) > -1
    ) {
      messageActionsAfterPermission.push(MESSAGE_ACTIONS.edit);
    }

    if (
      this.canDeleteMessage(message) &&
      messageActions.indexOf(MESSAGE_ACTIONS.delete) > -1
    ) {
      messageActionsAfterPermission.push(MESSAGE_ACTIONS.delete);
    }

    if (
      !this.isMyMessage(message) &&
      messageActions.indexOf(MESSAGE_ACTIONS.flag) > -1
    ) {
      messageActionsAfterPermission.push(MESSAGE_ACTIONS.flag);
    }

    if (
      !this.isMyMessage(message) &&
      messageActions.indexOf(MESSAGE_ACTIONS.mute) > -1 &&
      mutes
    ) {
      messageActionsAfterPermission.push(MESSAGE_ACTIONS.mute);
    }

    return messageActionsAfterPermission;
  };

  render() {
    const config = this.props.channel.getConfig();
    const { message } = this.props;

    const actionsEnabled =
      message.type === 'regular' && message.status === 'received';

    const MessageUIComponent = this.props.Message;
    return (
      <MessageUIComponent
        {...this.props}
        actionsEnabled={actionsEnabled}
        Message={this}
        handleReaction={this.handleReaction}
        getMessageActions={this.getMessageActions}
        handleFlag={this.handleFlag}
        handleMute={this.handleMute}
        handleAction={this.handleAction}
        handleDelete={this.handleDelete}
        handleEdit={this.handleEdit}
        handleRetry={this.handleRetry}
        handleOpenThread={
          this.props.openThread && this.props.openThread.bind(this, message)
        }
        isUserMuted={this.isUserMuted}
        isMyMessage={this.isMyMessage}
        channelConfig={config}
        onMentionsClickMessage={this.onMentionsClick}
        onMentionsHoverMessage={this.onMentionsHover}
        onUserClick={this.onUserClick}
        onUserHover={this.onUserHover}
      />
    );
  }
}

export default withTranslationContext(Message);
