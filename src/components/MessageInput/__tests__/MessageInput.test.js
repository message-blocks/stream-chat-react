import React from 'react';
import { cleanup, render, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import axios from 'axios';
import MessageInput from '../MessageInput';
import { Chat } from '../../Chat';
import { Channel } from '../../Channel';
import {
  generateChannel,
  generateMember,
  generateUser,
  generateMessage,
  useMockedApis,
  getOrCreateChannelApi,
  getTestClientWithUser,
} from '../../../mock-builders';

// mock image loader fn used by ImagePreview
jest.mock('blueimp-load-image/js/load-image-fetch', () => {
  return jest.fn().mockImplementation(() => Promise.resolve());
});

jest.mock('axios');
let chatClient;
let channel;

// mock i18n
const t = (key) => key;

const submitMock = jest.fn();
const editMock = jest.fn();

// MessageInput components rely on ChannelContext.
// ChannelContext is created by Channel component,
// Which relies on ChatContext, created by Chat component.
const renderComponent = (props = {}) =>
  render(
    <Chat client={chatClient}>
      <Channel
        channel={channel}
        doSendMessageRequest={submitMock}
        doUpdateMessageRequest={editMock}
      >
        <MessageInput {...props} t={t} />
      </Channel>
    </Chat>,
  );

describe('MessageInput', () => {
  const inputPlaceholder = 'Type your message';
  const username = 'username';
  const userid = 'userid';

  // First, set up a client and channel, so we can properly set up the context etc.
  beforeAll(async () => {
    const user1 = generateUser({ name: username, id: userid });
    const message1 = generateMessage({ user: user1 });
    const mockedChannel = generateChannel({
      messages: [message1],
      members: [generateMember({ user: user1 })],
    });
    useMockedApis(axios, [getOrCreateChannelApi(mockedChannel)]);
    chatClient = await getTestClientWithUser({ id: user1.id });
    channel = chatClient.channel('messaging', mockedChannel.id);
    // channel.editMessage = jest.fn();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  function dropFile(file, formElement) {
    fireEvent.drop(formElement, {
      dataTransfer: {
        files: [file],
      },
    });
  }

  const filename = 'some.txt';
  const fileUploadUrl = 'http://www.getstream.io'; // real url, because ImagePreview will try to load the image

  const getImage = () => new File(['content'], filename, { type: 'image/png' });
  const getFile = () => new File(['content'], filename, { type: 'text/plain' });

  const mockUploadApi = () =>
    jest.fn().mockImplementation(() =>
      Promise.resolve({
        file: fileUploadUrl,
      }),
    );

  const mockFaultyUploadApi = (cause) =>
    jest.fn().mockImplementation(() => Promise.reject(cause));

  it('Should shift focus to the textarea if the `focus` prop is true', async () => {
    const { getByPlaceholderText } = renderComponent({
      focus: true,
    });
    await waitFor(() => {
      expect(getByPlaceholderText(inputPlaceholder)).toHaveFocus();
    });
  });

  it('Should open the emoji picker after clicking the icon, and allow adding emojis to the message', async () => {
    const {
      container,
      findByTitle,
      queryByText,
      getByDisplayValue,
    } = renderComponent();

    const emojiIcon = await findByTitle('Open emoji picker');
    fireEvent.click(emojiIcon);

    expect(queryByText('Pick your emoji…')).toBeInTheDocument();

    const emoji = '💯';
    const emojiButton = queryByText(emoji);
    expect(emojiButton).toBeInTheDocument();

    fireEvent.click(emojiButton);

    // expect input to have emoji as value
    expect(getByDisplayValue(emoji)).toBeInTheDocument();

    // close picker
    fireEvent.click(container);
    expect(queryByText('Pick your emoji…')).not.toBeInTheDocument();
  });

  describe('Attachments', () => {
    it('Pasting images and files should result in uploading the files and showing previewers', async () => {
      const doImageUploadRequest = mockUploadApi();
      const doFileUploadRequest = mockUploadApi();
      const { findByPlaceholderText, findByText } = renderComponent({
        doFileUploadRequest,
        doImageUploadRequest,
      });

      const file = getFile();
      const image = getImage();

      const clipboardEvent = new Event('paste', {
        bubbles: true,
      });
      // set `clipboardData`. Mock DataTransfer object
      clipboardEvent.clipboardData = {
        items: [
          {
            kind: 'file',
            getAsFile: () => file,
          },
          {
            kind: 'file',
            getAsFile: () => image,
          },
        ],
      };
      const formElement = await findByPlaceholderText(inputPlaceholder);
      formElement.dispatchEvent(clipboardEvent);
      const filenameText = await findByText(filename);
      await waitFor(() => {
        expect(doFileUploadRequest).toHaveBeenCalledWith(
          file,
          expect.any(Object),
        );
        expect(filenameText).toBeInTheDocument();
        expect(filenameText.closest('a')).toHaveAttribute(
          'href',
          fileUploadUrl,
        );
        expect(doImageUploadRequest).toHaveBeenCalledWith(
          image,
          expect.any(Object),
        );
      });
    });

    it('Should upload an image when it is dropped on the dropzone', async () => {
      const doImageUploadRequest = mockUploadApi();
      const { findByPlaceholderText } = renderComponent({
        doImageUploadRequest,
      });
      // drop on the form input. Technically could be dropped just outside of it as well, but the input should always work.
      const formElement = await findByPlaceholderText(inputPlaceholder);
      const file = getImage();
      dropFile(file, formElement);

      await waitFor(() => {
        expect(doImageUploadRequest).toHaveBeenCalledWith(
          file,
          expect.any(Object),
        );
      });
    });

    it('Should upload, display and link to a file when it is dropped on the dropzone', async () => {
      const { findByPlaceholderText, findByText } = renderComponent({
        doFileUploadRequest: mockUploadApi(),
      });
      // drop on the form input. Technically could be dropped just outside of it as well, but the input should always work.
      const formElement = await findByPlaceholderText(inputPlaceholder);
      dropFile(getFile(), formElement);

      const filenameText = await findByText(filename);

      expect(filenameText).toBeInTheDocument();
      expect(filenameText.closest('a')).toHaveAttribute('href', fileUploadUrl);
    });

    it('should allow uploading files with the file upload button', async () => {
      const { findByTestId, findByText } = renderComponent({
        doFileUploadRequest: mockUploadApi(),
      });
      const file = getFile();
      const input = (await findByTestId('fileinput')).querySelector('input');

      fireEvent.change(input, {
        target: {
          files: [file],
        },
      });

      const filenameText = await findByText(filename);

      expect(filenameText).toBeInTheDocument();
      expect(filenameText.closest('a')).toHaveAttribute('href', fileUploadUrl);
    });

    it('Should call error handler if an image failed to upload', async () => {
      const cause = new Error('failed to upload');
      const doImageUploadRequest = mockFaultyUploadApi(cause);
      const errorHandler = jest.fn();
      const { findByPlaceholderText } = renderComponent({
        doImageUploadRequest,
        errorHandler,
      });
      jest.spyOn(console, 'warn').mockImplementationOnce(() => null);
      const formElement = await findByPlaceholderText(inputPlaceholder);
      const file = getImage();
      dropFile(file, formElement);

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          cause,
          'upload-image',
          expect.any(Object),
        );
        expect(doImageUploadRequest).toHaveBeenCalledWith(
          file,
          expect.any(Object),
        );
      });
    });

    it('Should call error handler if a file failed to upload and allow retrying', async () => {
      const cause = new Error('failed to upload');
      const doFileUploadRequest = mockFaultyUploadApi(cause);
      const errorHandler = jest.fn();

      const { findByPlaceholderText, findByText } = renderComponent({
        doFileUploadRequest,
        errorHandler,
      });
      jest.spyOn(console, 'warn').mockImplementationOnce(() => null);
      const formElement = await findByPlaceholderText(inputPlaceholder);
      const file = getFile();
      dropFile(file, formElement);

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          cause,
          'upload-file',
          expect.any(Object),
        );
        expect(doFileUploadRequest).toHaveBeenCalledWith(
          file,
          expect.any(Object),
        );
      });

      doFileUploadRequest.mockImplementationOnce(() =>
        Promise.resolve({ file }),
      );

      fireEvent.click(await findByText('retry'));

      await waitFor(() =>
        expect(doFileUploadRequest).toHaveBeenCalledWith(
          file,
          expect.any(Object),
        ),
      );
    });

    // TODO: Check if pasting plaintext is not prevented -> tricky because recreating exact event is hard
    // TODO: Remove image/file -> difficult because there is no easy selector and components are in react-file-utils
  });

  describe('Submitting', () => {
    it('Should submit the input value when clicking the submit button', async () => {
      const { findByTitle, findByPlaceholderText } = renderComponent();
      const submitButton = await findByTitle('Send');

      const messageText = 'Some text';

      fireEvent.change(await findByPlaceholderText(inputPlaceholder), {
        target: {
          value: messageText,
        },
      });
      fireEvent.click(submitButton);

      expect(submitMock).toHaveBeenCalledWith(
        channel.cid,
        expect.objectContaining({
          text: messageText,
        }),
      );
    });

    it('Should use overrideSubmitHandler prop if it is defined', async () => {
      const overrideMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve());
      const { findByTitle, findByPlaceholderText } = renderComponent({
        overrideSubmitHandler: overrideMock,
      });
      const submitButton = await findByTitle('Send');
      const messageText = 'Some text';

      fireEvent.change(await findByPlaceholderText(inputPlaceholder), {
        target: {
          value: messageText,
        },
      });
      fireEvent.click(submitButton);

      expect(overrideMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: messageText,
        }),
        channel.cid,
      );
    });

    it('Should not do anything if the message is empty and has no files', async () => {
      const { findByTitle } = renderComponent();
      const submitButton = await findByTitle('Send');

      fireEvent.click(submitButton);

      expect(submitMock).not.toHaveBeenCalled();
    });

    it('should add image as attachment if a message is submitted with an image', async () => {
      const doImageUploadRequest = mockUploadApi();
      const { findByTitle, findByPlaceholderText } = renderComponent({
        doImageUploadRequest,
      });
      const submitButton = await findByTitle('Send');

      const formElement = await findByPlaceholderText(inputPlaceholder);
      const file = getImage();
      dropFile(file, formElement);

      // wait for image uploading to complete before trying to send the message
      // eslint-disable-next-line jest/prefer-called-with
      await waitFor(() => expect(doImageUploadRequest).toHaveBeenCalled());
      fireEvent.click(submitButton);
      expect(submitMock).toHaveBeenCalledWith(
        channel.cid,
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              image_url: fileUploadUrl,
            }),
          ]),
        }),
      );
    });

    it('should add file as attachment if a message is submitted with an file', async () => {
      const doFileUploadRequest = mockUploadApi();
      const { findByTitle, findByPlaceholderText } = renderComponent({
        doFileUploadRequest,
      });
      const submitButton = await findByTitle('Send');

      const formElement = await findByPlaceholderText(inputPlaceholder);
      const file = getFile();
      dropFile(file, formElement);

      // wait for file uploading to complete before trying to send the message
      // eslint-disable-next-line jest/prefer-called-with
      await waitFor(() => expect(doFileUploadRequest).toHaveBeenCalled());
      fireEvent.click(submitButton);
      expect(submitMock).toHaveBeenCalledWith(
        channel.cid,
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              asset_url: fileUploadUrl,
            }),
          ]),
        }),
      );
    });
  });

  describe('Editing', () => {
    it('Should edit a message if it is passed through the message prop', async () => {
      const message = generateMessage({
        mentioned_users: [],
      });
      const { findByTitle } = renderComponent({
        clearEditingState: () => {},
        message,
      });
      const submitButton = await findByTitle('Send');
      fireEvent.click(submitButton);

      expect(editMock).toHaveBeenCalledWith(
        channel.cid,
        expect.objectContaining({
          text: message.text,
        }),
      );
    });

    it('Should take file attachments from the Message object in props and pass them down to the Input', () => {
      const file = {
        type: 'file',
        asset_url: 'somewhere.txt',
        mime_type: 'text/plain',
        title: 'title',
        file_size: 1000,
      };
      const image = {
        type: 'image',
        image_url: 'somewhere.png',
        fallback: 'fallback.png',
      };

      const attachments = [file, image];

      const MessageChecker = ({ fileUploads, imageUploads }) => {
        expect(Object.keys(fileUploads)).toHaveLength(1);
        expect(Object.keys(imageUploads)).toHaveLength(1);
        const fileUpload = Object.values(fileUploads)[0];
        const imageUpload = Object.values(imageUploads)[0];

        expect(fileUpload.url).toStrictEqual(file.asset_url);
        expect(imageUpload.url).toStrictEqual(image.image_url);
        return null;
      };

      renderComponent({
        Input: MessageChecker,
        message: generateMessage({
          attachments,
          mentioned_users: [],
        }),
      });
    });
  });

  it('Should add a mentioned user if @ is typed and a user is selected', async () => {
    const {
      findByPlaceholderText,
      findByText,
      findByTitle,
    } = renderComponent();

    const formElement = await findByPlaceholderText(inputPlaceholder);
    fireEvent.change(formElement, {
      target: {
        value: '@',
        selectionEnd: 1,
      },
    });
    const usernameListItem = await findByText(username);
    expect(usernameListItem).toBeInTheDocument();

    fireEvent.click(usernameListItem);
    const submitButton = await findByTitle('Send');

    fireEvent.click(submitButton);
    expect(submitMock).toHaveBeenCalledWith(
      channel.cid,
      expect.objectContaining({
        mentioned_users: expect.arrayContaining([userid]),
      }),
    );
  });
});
