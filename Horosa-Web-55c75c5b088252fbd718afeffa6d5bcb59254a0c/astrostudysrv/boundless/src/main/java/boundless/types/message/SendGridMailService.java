package boundless.types.message;

import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.Response;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Attachments;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import com.sendgrid.helpers.mail.objects.Personalization;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

public class SendGridMailService {
    private final String SENDGRID_ENDPOINT = "mail/send";
    private final String HTML_TYPE = "text/html";
    
    private String fromEmailAddress;
    private String fromName;
    private SendGrid sendGrid;

    public SendGridMailService(String sendGridAPIKey, String fromEmailAddress, String fromName) {
        sendGrid = new SendGrid(sendGridAPIKey);
        this.fromEmailAddress = fromEmailAddress;
        this.fromName = fromName;
    }

    /**
     * Method to send mail with out an attachment.
     *
     * @param toEmailsList -- List of to email addresses.
     * @param ccEmailsList -- List of cc email addresses.
     * @param bccEmailsList -- List of bcc email addresses.
     * @param subject -- Subject of the mail.
     * @param body -- Content of the body mail.
     */
    public void sendMailWithoutAttachment(List<String> toEmailsList, List<String> ccEmailsList, List<String> bccEmailsList, String subject, String body) {
        sendMail(toEmailsList, ccEmailsList, bccEmailsList, HTML_TYPE, subject, body, Optional.empty());
    }
    
    /**
     * Method to send mail with an attachment.
     *
     * @param toEmailsList -- List of to email addresses.
     * @param ccEmailsList -- List of cc email addresses.
     * @param bccEmailsList -- List of bcc email addresses.
     * @param subject -- Subject of the mail.
     * @param body -- Content of the body mail.
     * @param attachment -- Holds the type to file along with content to be attached in the mail. Use method convertPathToAttachment(filepath, attchmentType) method to get attachment object.
     */
    public void sendMailWithAttachment(List<String> toEmailsList, List<String> ccEmailsList, List<String> bccEmailsList, String subject, String body, Optional<Attachments> attachment) {
        sendMail(toEmailsList, ccEmailsList, bccEmailsList, HTML_TYPE, subject, body, attachment);
    }
    
    /**
     * Method to send mail with attachment if is present using send grid sdk.
     * Attaches attachment object if it present.
     *
     *
     * @param toEmailsList -- List of to email addresses.
     * @param ccEmailsList -- List of cc email addresses.
     * @param bccEmailsList -- List of bcc email addresses.
     * @param contentType -- Type of the content type to be send in the body of the mail. ex: text/plain, text/html etc.,
     * @param subject -- Subject of the mail.
     * @param body -- Content of the body mail.
     * @param attachment -- Holds the file content to be attached in the mail.
     */
    private void sendMail(List<String> toEmailsList, List<String> ccEmailsList, List<String> bccEmailsList, String contentType,
                                String subject, String body, Optional<Attachments> attachment) {
        try {
          if(Objects.isNull(toEmailsList) || toEmailsList.size() == 0)
            return;
          Email fromEmail = new Email(fromEmailAddress, fromName);
          Content bodyContent = new Content(contentType, body);
          Mail mail = new Mail();
          mail.setFrom(fromEmail);
          mail.setSubject(subject);
          mail.addContent(bodyContent);
          Personalization personalization = new Personalization();
          //add to email addresses
          toEmailsList.forEach(toAddress -> {
              Email toEmail = new Email(toAddress);
              personalization.addTo(toEmail);
          });
          //add cc email addresses
          if(Objects.nonNull(ccEmailsList) && ccEmailsList.size() > 0){
              ccEmailsList.forEach(ccAddress -> {
                  Email ccEmail = new Email(ccAddress);
                  personalization.addCc(ccEmail);
              });
          }
          //add bcc email addresses
          if(Objects.nonNull(bccEmailsList) && bccEmailsList.size() > 0){
              bccEmailsList.forEach(bccAddress -> {
                  Email bccEmail = new Email(bccAddress);
                  personalization.addBcc(bccEmail);
              });
          }
          mail.addPersonalization(personalization);
  
          //Add an attachment if it is present
          attachment.ifPresent(mail::addAttachments);
  
          Request request = new Request();
          request.setMethod(Method.POST);
          request.setEndpoint(SENDGRID_ENDPOINT);
          request.setBody(mail.build());
          Response response = sendGrid.api(request);
          System.out.println("Email Sent: response status code:"  + response.getStatusCode());
          System.out.println("Email Sent: response status body:" + response.getBody());
        } catch(Exception ex) {
            System.err.println("Error in sending email->" + ex.getLocalizedMessage());
            ex.printStackTrace();
        }
    }
    
    /**
     * Method to convert file into send grid specific attachment object.
     *
     * @param filePath -- Path of the file to be converted into an attachment object.
     * @param attachmentFileType -- Type of the file to be converted. ex: application/pdf, application/json etc.,
     * @return -- Returns the send grid specific attachment object which holds the file content, file name and its type.
     */
    public Optional<Attachments> convertPathToAttachment(Path filePath, String attachmentFileType) {
        try {
            if(!filePath.toFile().exists()) {
                return Optional.empty();
            }
            Attachments attachment = new Attachments();
            byte[] attachmentContentBytes = Files.readAllBytes(filePath);
            String attachmentContent = Base64.getEncoder().encodeToString(attachmentContentBytes);
            attachment.setContent(attachmentContent);
            attachment.setType(attachmentFileType);
            attachment.setFilename(filePath.getFileName().toString());
            attachment.setDisposition("attachment");
            return Optional.of(attachment);
        } catch (IOException io) {
            System.out.println("Error in reading and converting file ->" + filePath.toString());
            io.printStackTrace();
        }
        return Optional.empty();
    }

}
