//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by Paweł Mazurkiewicz on 12/09/2025.
//

import SafariServices
import os.log
import Foundation
import AppKit


class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        // Handle the message from the background script
        self.handleExtensionMessage(message: message, context: context, profile: profile)
    }
    
    private func handleExtensionMessage(message: Any?, context: NSExtensionContext, profile: UUID?) {
        guard let messageDict = message as? [String: Any] else {
            os_log(.error, "Invalid message format received")
            self.sendResponse(success: false, error: "Invalid message format", context: context)
            return
        }
        
        guard let messageType = messageDict["type"] as? String else {
            os_log(.error, "Message missing type field")
            self.sendResponse(success: false, error: "Message missing type", context: context)
            return
        }
        
        os_log(.info, "Processing message type: %@", messageType)
        
        switch messageType {
        case "FORWARD_URL":
            self.handleForwardUrl(messageDict: messageDict, context: context)
            
        default:
            os_log(.error, "Unknown message type: %@", messageType)
            self.sendResponse(success: false, error: "Unknown message type", context: context)
        }
    }
    
    private func handleForwardUrl(messageDict: [String: Any], context: NSExtensionContext) {
        guard let urlString = messageDict["url"] as? String else {
            os_log(.error, "FORWARD_URL message missing url field")
            self.sendResponse(success: false, error: "Missing URL", context: context)
            return
        }
        
        guard let url = URL(string: urlString), url.scheme == "http" || url.scheme == "https" else {
            os_log(.error, "Invalid URL format: %@", urlString)
            self.sendResponse(success: false, error: "Invalid URL format", context: context)
            return
        }
        
        os_log(.info, "Forwarding URL to Proxly: %@", urlString)
        
        // Create the proxly:// URL
        let encodedUrl = Data(urlString.utf8).base64EncodedString()
        let proxlyUrlString = "proxly://open/\(encodedUrl)"
        
        guard let proxlyUrl = URL(string: proxlyUrlString) else {
            os_log(.error, "Failed to create proxly URL from: %@", urlString)
            self.sendResponse(success: false, error: "Failed to create proxly URL", context: context)
            return
        }
        
        // Attempt to open the proxly:// URL
        DispatchQueue.main.async {
            let success = NSWorkspace.shared.open(proxlyUrl)
            if success {
                os_log(.info, "Successfully opened proxly URL: %@", proxlyUrlString)
                self.sendResponse(success: true, error: nil, context: context)
            } else {
                os_log(.error, "Failed to open proxly URL: %@", proxlyUrlString)
                self.sendResponse(success: false, error: "Failed to open Proxly", context: context)
            }
        }
    }
    
    private func sendResponse(success: Bool, error: String?, context: NSExtensionContext) {
        let response = NSExtensionItem()
        var responseData: [String: Any] = ["success": success]
        
        if let error = error {
            responseData["error"] = error
        }
        
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: responseData]
        } else {
            response.userInfo = ["message": responseData]
        }
        
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
