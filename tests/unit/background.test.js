import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installChromeMock } from '../setup.js';
import { loadExtSource } from '../helpers.js';

describe('background.js', () => {
  beforeEach(() => {
    installChromeMock();
  });

  it('registers an onInstalled listener', () => {
    loadExtSource('background.js');
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
  });

  it('logs on install', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    loadExtSource('background.js');
    const handler = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
    handler({ reason: 'install' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('installed'));
    logSpy.mockRestore();
  });

  it('logs on update', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    loadExtSource('background.js');
    const handler = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
    handler({ reason: 'update' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('updated'));
    logSpy.mockRestore();
  });

  it('does nothing on other reasons', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    loadExtSource('background.js');
    const handler = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
    handler({ reason: 'chrome_update' });
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
